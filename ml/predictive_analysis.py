import requests
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import sys
import io
import json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

url = "http://localhost:5000/jira/issues"
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
except requests.exceptions.RequestException as e:
    print(f"[ERROR] Network or backend issue: {e}", file=sys.stderr)
    sys.exit(1)

try:
    data = response.json()
    issues = data.get("issues", [])
    if not issues:
        print("[WARNING] No issues found in API response.", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"[ERROR] Error parsing response: {e}", file=sys.stderr)
    sys.exit(1)

rows = []
for issue in issues:
    f = issue.get("fields", {})
    rows.append({
        "id": issue.get("id"),
        "key": issue.get("key"),
        "summary": f.get("summary", ""),
        "assignee": f.get("assignee", {}).get("displayName", "Unassigned"),
        "status": f.get("status", {}).get("name", "Unknown"),
        "priority": f.get("priority", {}).get("name", "None"),
        "issuetype": f.get("issuetype", {}).get("name", "Other"),
        "created": f.get("created", datetime.now().isoformat())
    })

df = pd.DataFrame(rows)
df["created"] = pd.to_datetime(df["created"], utc=True, errors="coerce")
df["age_days"] = (datetime.now().astimezone() - df["created"]).dt.days.fillna(0)
status_map = {"To Do": 0, "In Progress": 1, "Done": 2}
df["status_score"] = df["status"].map(status_map).fillna(1)
df["assignee_original"] = df["assignee"].copy()
df["priority_original"] = df["priority"].copy()
df["issuetype_original"] = df["issuetype"].copy()

for col in ["assignee", "priority", "issuetype"]:
    df[col] = df[col].astype("category").cat.codes

print("[OK] Data loaded and processed successfully!")
print(df.head())

df.to_csv("jira_processed.csv", index=False)

# Build predictive model - determine if issue is delayed
# An issue is considered delayed if:
# - Status is not "Done" AND (status_score < 2 means not completed)
df["delayed"] = (df["status_score"] < 2).astype(int)
X = df[["assignee", "priority", "issuetype", "age_days", "status_score"]]
y = df["delayed"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n[OK] Model trained successfully!")
print("Accuracy:", round(accuracy, 3))

output_df = df.copy()
output_df["assignee"] = output_df["assignee_original"]
output_df["priority"] = output_df["priority_original"]
output_df["issuetype"] = output_df["issuetype_original"]
# Drop encoded columns but keep delayed for predictions
output_df = output_df.drop(columns=["assignee_original", "priority_original", "issuetype_original"])

predictions_json = {
    "accuracy": float(accuracy),
    "predictions": output_df.to_dict("records")
}

with open("predictions.json", "w") as f:
    json.dump(predictions_json, f, indent=2, default=str)

print("\n[OK] Predictions exported to predictions.json")
