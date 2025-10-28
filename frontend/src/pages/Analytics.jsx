import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
  const [issues, setIssues] = useState([]);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [issuesRes, riskRes] = await Promise.all([
          fetch("http://localhost:5000/jira/issues"),
          fetch("http://localhost:5000/jira/risk"),
        ]);

        const issuesData = await issuesRes.json();
        const riskData = await riskRes.json();

        setIssues(issuesData.issues || []);
        setRisk(riskData);
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <div className="text-center text-lg mt-10">Loading analytics...</div>
    );

  const statusCount = {};
  const assigneeCount = {};
  const typeCount = {};

  issues.forEach((issue) => {
    const status = issue.fields.status.name;
    let assignee = issue.fields.assignee.displayName;
    if (assignee === "ARPIT@GMAIL.COM") assignee = "Arpit Baiju";
    if (assignee.toLowerCase() === "aaron") assignee = "Aaron Alphons Thomas";
    const type = issue.fields.issuetype.name;

    statusCount[status] = (statusCount[status] || 0) + 1;
    assigneeCount[assignee] = (assigneeCount[assignee] || 0) + 1;
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  const statusData = Object.entries(statusCount).map(([name, Value]) => ({
    name,
    Value,
  }));
  const assigneeData = Object.entries(assigneeCount).map(([name, Value]) => ({
    name,
    Value,
  }));
  const typeData = Object.entries(typeCount).map(([name, Value]) => ({
    name,
    Value,
  }));

  const totalTasks = issues.length;
  const todoTasks = statusCount["To Do"] || statusCount["Open"] || 0;
  const inProgressTasks =
    statusCount["In Progress"] || statusCount["Doing"] || 0;
  const completedTasks =
    statusCount["Done"] ||
    statusCount["Completed"] ||
    statusCount["Closed"] ||
    0;

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A55EEA",
    "#FF6B6B",
  ];

  // Sprint health calculation
  const completedPct = ((completedTasks / totalTasks) * 100).toFixed(1);
  const inProgressPct = ((inProgressTasks / totalTasks) * 100).toFixed(1);
  const remainingPct = (100 - completedPct - inProgressPct).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-10">
        📊 SmartSprint – Agile Analytics Dashboard
      </h1>

      {risk && (
        <div className="max-w-3xl mx-auto mb-10 p-6 bg-white shadow-lg rounded-2xl text-center">
          <h2 className="text-2xl font-semibold mb-4">Sprint Risk Score</h2>
          <div className="text-5xl font-bold text-red-500 mb-4">
            {risk.score}%
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-700">
            <div>
              <p className="font-semibold">Unassigned</p>
              <p>{risk.metrics.unassignedRate}%</p>
            </div>
            <div>
              <p className="font-semibold">WIP</p>
              <p>{risk.metrics.wipRate}%</p>
            </div>
            <div>
              <p className="font-semibold">Avg Age (Days)</p>
              <p>{risk.metrics.avgOpenAgeDays}</p>
            </div>
            <div>
              <p className="font-semibold">Workload Imbalance</p>
              <p>{risk.metrics.imbalance}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Sprint Health Meter */}
      <div className="max-w-3xl mx-auto mb-10 p-6 bg-white shadow-lg rounded-2xl">
        <h2 className="text-2xl font-semibold text-center mb-4">
          🩺 Sprint Health
        </h2>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden mb-3">
          <div
            className="bg-green-500 h-6 inline-block"
            style={{ width: `${completedPct}%` }}
            title={`Completed: ${completedPct}%`}
          ></div>
          <div
            className="bg-orange-400 h-6 inline-block"
            style={{ width: `${inProgressPct}%` }}
            title={`In Progress: ${inProgressPct}%`}
          ></div>
          <div
            className="bg-gray-400 h-6 inline-block"
            style={{ width: `${remainingPct}%` }}
            title={`Remaining: ${remainingPct}%`}
          ></div>
        </div>
        <div className="flex justify-between text-sm text-gray-700">
          <span>✅ Completed: {completedPct}%</span>
          <span>⚙️ In Progress: {inProgressPct}%</span>
          <span>🕓 Remaining: {remainingPct}%</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 max-w-5xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-md text-center">
          <h3 className="text-gray-500 font-semibold mb-2">Total Tasks</h3>
          <p className="text-4xl font-bold text-blue-600">{totalTasks}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md text-center">
          <h3 className="text-gray-500 font-semibold mb-2">To Do</h3>
          <p className="text-4xl font-bold text-yellow-500">{todoTasks}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md text-center">
          <h3 className="text-gray-500 font-semibold mb-2">In Progress</h3>
          <p className="text-4xl font-bold text-orange-500">
            {inProgressTasks}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md text-center">
          <h3 className="text-gray-500 font-semibold mb-2">Completed</h3>
          <p className="text-4xl font-bold text-green-500">{completedTasks}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Issue Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="Value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {statusData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Tasks per Assignee
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={assigneeData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Value" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Issue Types
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={typeData}
                dataKey="Value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {typeData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
