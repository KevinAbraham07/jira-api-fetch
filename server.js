import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

const jiraAuth = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
).toString("base64");

app.get("/jira/issues", async (req, res) => {
  try {
    const response = await fetch(
      `https://${process.env.JIRA_DOMAIN}/rest/agile/1.0/sprint/${process.env.JIRA_SPRINT_ID}/issue?fields=summary,assignee,status,priority,issuetype,created`,
      {
        headers: {
          Authorization: `Basic ${jiraAuth}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    const filtered = {
      issues: data.issues.map((issue) => ({
        id: issue.id,
        key: issue.key,
        fields: {
          summary: issue.fields.summary,
          assignee: {
            displayName: issue.fields.assignee?.displayName || "Unassigned",
          },
          status: { name: issue.fields.status.name },
          priority: { name: issue.fields.priority?.name || "None" },
          issuetype: { name: issue.fields.issuetype.name },
          created: issue.fields.created,
        },
      })),
    };

    res.send(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch Jira issues" });
  }
});

function calculateSprintRisk(issues) {
  const total = issues.length;
  const now = new Date();
  const statusCounts = { todo: 0, progress: 0, done: 0 };
  const assignees = {};
  let totalAge = 0;
  let openCount = 0;
  let unassigned = 0;

  for (const issue of issues) {
    const { status, assignee, created } = issue.fields;
    const state = status.name.toLowerCase();

    if (state.includes("to do")) statusCounts.todo++;
    else if (state.includes("progress")) statusCounts.progress++;
    else if (state.includes("done")) statusCounts.done++;

    const name = assignee.displayName;
    if (name === "Unassigned") unassigned++;
    assignees[name] = (assignees[name] || 0) + 1;

    if (state !== "done") {
      openCount++;
      const ageDays = (now - new Date(created)) / (1000 * 60 * 60 * 24);
      totalAge += ageDays;
    }
  }

  const unassignedRate = unassigned / total;
  const wipRate = statusCounts.progress / total;
  const avgAge = openCount ? totalAge / openCount : 0;
  const workloads = Object.values(assignees);
  const maxLoad = Math.max(...workloads);
  const minLoad = Math.min(...workloads);
  const imbalance = total > 0 ? (maxLoad - minLoad) / total : 0;

  const score =
    100 *
    (0.25 * unassignedRate +
      0.25 * wipRate +
      0.3 * Math.min(avgAge / 7, 1) +
      0.2 * imbalance);

  return {
    score: +score.toFixed(1),
    metrics: {
      unassignedRate: +(unassignedRate * 100).toFixed(1),
      wipRate: +(wipRate * 100).toFixed(1),
      avgOpenAgeDays: +avgAge.toFixed(1),
      imbalance: +(imbalance * 100).toFixed(1),
    },
  };
}

app.get("/jira/risk", async (req, res) => {
  try {
    const response = await fetch(`http://localhost:${PORT}/jira/issues`);
    const { issues } = await response.json();
    const result = calculateSprintRisk(issues);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compute risk score" });
  }
});

app.get("/jira/predictive", async (req, res) => {
  try {
    const pythonScriptPath = path.join(__dirname, "ml", "predictive_analysis.py");
    
    // Execute the Python script from the project root directory
    // This ensures relative paths work correctly
    const execOptions = {
      cwd: __dirname, // Set working directory to project root
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
    };
    
    // Execute the Python script (try python3 first, fallback to python)
    let stdout, stderr;
    try {
      ({ stdout, stderr } = await execAsync(`python3 "${pythonScriptPath}"`, execOptions));
    } catch (err) {
      try {
        ({ stdout, stderr } = await execAsync(`python "${pythonScriptPath}"`, execOptions));
      } catch (err2) {
        // Check if Python dependencies are missing
        const pythonError = err2.stderr || err2.message || String(err2);
        if (pythonError.includes("ModuleNotFoundError") || pythonError.includes("No module named")) {
          throw new Error(`Python dependencies missing. Please install: pip install requests pandas scikit-learn\n\nError: ${pythonError}`);
        }
        throw new Error(`Python execution failed. Tried: python3 and python.\n\nError: ${pythonError}`);
      }
    }
    
    // Check if Python script failed (non-zero exit code or error in stderr)
    if (stderr && (stderr.includes("[ERROR]") || stderr.includes("ERROR") || stderr.includes("Error") || stderr.includes("Traceback") || stderr.includes("UnicodeEncodeError"))) {
      console.error("Python script error:", stderr);
      // If there's a critical error in stderr, treat it as a failure
      if (stderr.includes("[ERROR]") || stderr.includes("Traceback") || stderr.includes("UnicodeEncodeError")) {
        throw new Error(`Python script failed:\n${stderr}`);
      }
    }

    // Read the JSON predictions file
    const jsonPath = path.join(__dirname, "predictions.json");
    const csvPath = path.join(__dirname, "jira_processed.csv");
    
    // Try to read JSON first, fallback to CSV if needed
    let predictionsData = null;
    
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      predictionsData = JSON.parse(jsonContent);
    } else if (fs.existsSync(csvPath)) {
      // Fallback to CSV parsing if JSON doesn't exist
      const csvContent = fs.readFileSync(csvPath, "utf-8");
      const lines = csvContent.trim().split("\n");
      const headers = lines[0].split(",");
      
      const predictions = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const row = {};
        headers.forEach((header, idx) => {
          row[header.trim()] = values[idx]?.trim() || "";
        });
        predictions.push(row);
      }
      
      predictionsData = {
        accuracy: null,
        predictions: predictions
      };
    } else {
      return res.status(500).json({ 
        error: "Predictive analysis output not found",
        details: "Neither JSON nor CSV file was generated"
      });
    }

    // Extract accuracy from predictions data or stdout
    let accuracy = predictionsData.accuracy;
    if (!accuracy) {
      const accuracyMatch = stdout.match(/Accuracy:\s*([\d.]+)/);
      if (accuracyMatch) {
        accuracy = parseFloat(accuracyMatch[1]);
      }
    }

    const predictions = predictionsData.predictions || [];
    
    // Count delayed vs not delayed (handle both string and numeric)
    const delayedCount = predictions.filter(p => {
      const delayed = p.delayed;
      return delayed === "1" || delayed === 1 || delayed === true;
    }).length;
    const notDelayedCount = predictions.length - delayedCount;

    // Map predictions to frontend format
    const formattedPredictions = predictions.map(p => {
      const delayed = p.delayed === "1" || p.delayed === 1 || p.delayed === true;
      return {
        key: p.key || "",
        summary: p.summary || "",
        assignee: p.assignee || "Unassigned",
        status: p.status || "Unknown",
        priority: p.priority || "None",
        ageDays: parseFloat(p.age_days) || 0,
        isDelayed: delayed,
        delayedProbability: delayed ? 0.75 : 0.25 // Placeholder
      };
    });

    res.json({
      success: true,
      accuracy: accuracy,
      totalIssues: predictions.length,
      delayed: delayedCount,
      notDelayed: notDelayedCount,
      predictions: formattedPredictions,
      modelOutput: stdout
    });
  } catch (err) {
    console.error("Predictive analysis error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      success: false,
      error: "Failed to run predictive analysis",
      details: err.message || String(err),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
