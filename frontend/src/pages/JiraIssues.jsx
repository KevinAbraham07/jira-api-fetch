import React, { useEffect, useState } from "react";

const JiraIssues = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/jira/issues")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching Jira issues:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading Jira issues...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div style={{ padding: "1rem", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
        📊 Jira Issues Data
      </h1>
      <pre
        style={{
          backgroundColor: "#1e1e1e",
          color: "#00ff88",
          padding: "1rem",
          borderRadius: "10px",
          overflowX: "auto",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default JiraIssues;
