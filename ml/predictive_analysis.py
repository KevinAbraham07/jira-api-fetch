import requests
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# 1️⃣ Fetch data
url = "http://localhost:5000/jira/issues"
response = requests.get(url)

if response.status_code != 200:
    print("❌ Failed to fetch issues from backend")
    print("Status Code:", response.status_code)
    print("Response:", response.text)
    exit()

data = response.json()
issues = data.get("issues", [])
if not issues:
    print("⚠️ No issues found in API response.")
    exit()

# 2️⃣ Convert JSON into DataFrame
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

# 3️⃣ Feature engineering
df["created"] = pd.to_datetime(df["created"], utc=True, errors="coerce")
df["age_days"] = (datetime.now().astimezone() - df["created"]).dt.days.fillna(0)

status_map = {"To Do": 0, "In Progress": 1, "Done": 2}
df["status_score"] = df["status"].map(status_map).fillna(1)

for col in ["assignee", "priority", "issuetype"]:
    df[col] = df[col].astype("category").cat.codes

print("✅ Data loaded and processed successfully!")
print(df.head())

# 4️⃣ Save for later reuse
df.to_csv("jira_processed.csv", index=False)

# 5️⃣ Build predictive model
df["delayed"] = (df["status_score"] < 2).astype(int)
X = df[["assignee", "priority", "issuetype", "age_days", "status_score"]]
y = df["delayed"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print("\n✅ Model trained successfully!")
print("Accuracy:", accuracy_score(y_test, y_pred))
