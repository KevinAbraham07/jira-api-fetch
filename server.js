import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

    // Filter only the fields we want
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
