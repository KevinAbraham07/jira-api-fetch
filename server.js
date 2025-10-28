import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
