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
  const [predictive, setPredictive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // Add cache busting timestamp to force fresh data
      const timestamp = new Date().getTime();
      const [issuesRes, riskRes, predictiveRes] = await Promise.all([
        fetch(`http://localhost:5000/jira/issues?t=${timestamp}`),
        fetch(`http://localhost:5000/jira/risk?t=${timestamp}`),
        fetch(`http://localhost:5000/jira/predictive?t=${timestamp}`).catch(err => {
          console.warn("Predictive analysis not available:", err);
          return { ok: false, json: () => Promise.resolve({ error: "Predictive analysis unavailable" }) };
        }),
      ]);

      const issuesData = await issuesRes.json();
      const riskData = await riskRes.json();
      let predictiveData = null;
      
      if (predictiveRes.ok) {
        predictiveData = await predictiveRes.json();
      } else {
        // If fetch failed, still try to get error message
        try {
          predictiveData = await predictiveRes.json();
        } catch {
          predictiveData = { 
            error: "Failed to fetch predictive analysis",
            success: false 
          };
        }
      }

      setIssues(issuesData.issues || []);
      setRisk(riskData);
      setPredictive(predictiveData);
    } catch (err) {
      console.error("Failed to fetch analytics data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
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
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">
          Sprint Insights & Delivery Analytics
        </h1>
        <button
          onClick={fetchData}
          disabled={refreshing || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {refreshing ? (
            <>
              <span className="animate-spin">⟳</span>
              Refreshing...
            </>
          ) : (
            <>
              <span>⟳</span>
              Refresh
            </>
          )}
        </button>
      </div>

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

      {/* Predictive Analysis Section */}
      <div className="max-w-5xl mx-auto mb-10 p-6 bg-white shadow-lg rounded-2xl">
        <h2 className="text-2xl font-semibold mb-6 text-center">
          🤖 Predictive Analysis
        </h2>
        
        {!predictive ? (
          <div className="text-center py-8 text-gray-500">
            <p>Loading predictive analysis...</p>
          </div>
        ) : predictive.error ? (
          <div className="text-center py-8 text-red-500">
            <p className="font-semibold">Error loading predictive analysis</p>
            <p className="text-sm mt-2">{predictive.error}</p>
            {predictive.details && (
              <p className="text-xs mt-1 text-gray-600">{predictive.details}</p>
            )}
          </div>
        ) : predictive.success === false ? (
          <div className="text-center py-8 text-yellow-600">
            <p className="font-semibold">Predictive analysis unavailable</p>
            <p className="text-sm mt-2">The ML model may not be configured or Python dependencies are missing.</p>
          </div>
        ) : (
          <>
          
          {/* Model Accuracy and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">Model Accuracy</p>
              <p className="text-3xl font-bold text-blue-600">
                {predictive.accuracy ? (predictive.accuracy * 100).toFixed(1) : "N/A"}%
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">At Risk (Delayed)</p>
              <p className="text-3xl font-bold text-red-600">{predictive.delayed || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">On Track</p>
              <p className="text-3xl font-bold text-green-600">{predictive.notDelayed || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center">
              <p className="text-sm text-gray-600 mb-1">Total Issues</p>
              <p className="text-3xl font-bold text-purple-600">{predictive.totalIssues || 0}</p>
            </div>
          </div>

          {/* Delayed Issues Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Delay Prediction Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: "On Track", value: predictive.notDelayed || 0, color: "#10b981" },
                { name: "At Risk", value: predictive.delayed || 0, color: "#ef4444" }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Delayed Issues Table */}
          {predictive.predictions && predictive.predictions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Issues Predicted to be Delayed
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Key</th>
                      <th className="border p-2 text-left">Summary</th>
                      <th className="border p-2 text-left">Assignee</th>
                      <th className="border p-2 text-left">Status</th>
                      <th className="border p-2 text-left">Age (Days)</th>
                      <th className="border p-2 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictive.predictions
                      .filter(p => p.isDelayed)
                      .slice(0, 10)
                      .map((prediction, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border p-2 font-mono text-sm">{prediction.key}</td>
                          <td className="border p-2">{prediction.summary}</td>
                          <td className="border p-2">{prediction.assignee}</td>
                          <td className="border p-2">{prediction.status}</td>
                          <td className="border p-2">{prediction.ageDays.toFixed(1)}</td>
                          <td className="border p-2 text-center">
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold">
                              High Risk
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {predictive.predictions.filter(p => p.isDelayed).length > 10 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Showing top 10 of {predictive.predictions.filter(p => p.isDelayed).length} at-risk issues
                  </p>
                )}
              </div>
            </div>
          )}
          </>
        )}
      </div>

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
          <p className="text-4xl font-bold text-purple-500">{totalTasks}</p>
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

      {/* Charts - First Row: Issue Status Distribution and Issue Types in same row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
                labelStyle={{
                  color: "#e2e8f0",
                  fontWeight: "600",
                }}
                itemStyle={{ color: "#cbd5e1" }}
              />
              <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            </PieChart>
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
                labelStyle={{
                  color: "#e2e8f0",
                  fontWeight: "600",
                }}
                itemStyle={{ color: "#cbd5e1" }}
              />
              <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tasks per Assignee - Full Row */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4 text-center">
          Tasks per Assignee
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={assigneeData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "14px",
                fontWeight: 500,
              }}
              labelStyle={{
                color: "#e2e8f0",
                fontWeight: 600,
              }}
              itemStyle={{ color: "#cbd5e1" }}
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            <Bar dataKey="Value" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
