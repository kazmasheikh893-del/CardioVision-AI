"""Shared clinical feature definitions for CardioVision AI."""

from __future__ import annotations

FEATURES = [
    {
        "name": "age",
        "label": "Age",
        "type": "number",
        "unit": "years",
        "min": 18,
        "max": 100,
        "description": "Age in years.",
    },
    {
        "name": "sex",
        "label": "Sex",
        "type": "categorical",
        "options": [{"value": 0, "label": "Female"}, {"value": 1, "label": "Male"}],
        "description": "Biological sex as encoded in the original UCI dataset.",
    },
    {
        "name": "cp",
        "label": "Chest pain type",
        "type": "categorical",
        "options": [
            {"value": 1, "label": "Typical angina"},
            {"value": 2, "label": "Atypical angina"},
            {"value": 3, "label": "Non-anginal pain"},
            {"value": 4, "label": "Asymptomatic"},
        ],
        "description": "Chest pain category from the Cleveland heart disease schema.",
    },
    {
        "name": "trestbps",
        "label": "Resting blood pressure",
        "type": "number",
        "unit": "mm Hg",
        "min": 80,
        "max": 220,
        "description": "Resting blood pressure on admission to hospital.",
    },
    {
        "name": "chol",
        "label": "Serum cholesterol",
        "type": "number",
        "unit": "mg/dL",
        "min": 100,
        "max": 650,
        "description": "Serum cholesterol measurement.",
    },
    {
        "name": "fbs",
        "label": "Fasting blood sugar > 120 mg/dL",
        "type": "categorical",
        "options": [{"value": 0, "label": "False"}, {"value": 1, "label": "True"}],
        "description": "Whether fasting blood sugar exceeded 120 mg/dL.",
    },
    {
        "name": "restecg",
        "label": "Resting ECG",
        "type": "categorical",
        "options": [
            {"value": 0, "label": "Normal"},
            {"value": 1, "label": "ST-T wave abnormality"},
            {"value": 2, "label": "Probable/definite LV hypertrophy"},
        ],
        "description": "Resting electrocardiographic result.",
    },
    {
        "name": "thalach",
        "label": "Maximum heart rate",
        "type": "number",
        "unit": "bpm",
        "min": 60,
        "max": 230,
        "description": "Maximum heart rate achieved during exercise testing.",
    },
    {
        "name": "exang",
        "label": "Exercise-induced angina",
        "type": "categorical",
        "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}],
        "description": "Whether exercise induced angina.",
    },
    {
        "name": "oldpeak",
        "label": "ST depression",
        "type": "number",
        "unit": "mm",
        "min": 0,
        "max": 7,
        "step": 0.1,
        "description": "ST depression induced by exercise relative to rest.",
    },
    {
        "name": "slope",
        "label": "Peak exercise ST slope",
        "type": "categorical",
        "options": [
            {"value": 1, "label": "Upsloping"},
            {"value": 2, "label": "Flat"},
            {"value": 3, "label": "Downsloping"},
        ],
        "description": "Slope of the peak exercise ST segment.",
    },
    {
        "name": "ca",
        "label": "Major vessels colored",
        "type": "number",
        "unit": "0-3",
        "min": 0,
        "max": 3,
        "step": 1,
        "description": "Number of major vessels colored by fluoroscopy.",
    },
    {
        "name": "thal",
        "label": "Thalassemia stress result",
        "type": "categorical",
        "options": [
            {"value": 3, "label": "Normal"},
            {"value": 6, "label": "Fixed defect"},
            {"value": 7, "label": "Reversible defect"},
        ],
        "description": "Thallium stress test result.",
    },
]

FEATURE_NAMES = [feature["name"] for feature in FEATURES]
NUMERIC_FEATURES = ["age", "trestbps", "chol", "thalach", "oldpeak", "ca"]
CATEGORICAL_FEATURES = ["sex", "cp", "fbs", "restecg", "exang", "slope", "thal"]

DEMO_EXAMPLES = {
    "lower_probability": {
        "age": 41,
        "sex": 0,
        "cp": 2,
        "trestbps": 120,
        "chol": 204,
        "fbs": 0,
        "restecg": 0,
        "thalach": 172,
        "exang": 0,
        "oldpeak": 0.0,
        "slope": 1,
        "ca": 0,
        "thal": 3,
    },
    "higher_probability": {
        "age": 63,
        "sex": 1,
        "cp": 4,
        "trestbps": 145,
        "chol": 233,
        "fbs": 1,
        "restecg": 2,
        "thalach": 150,
        "exang": 0,
        "oldpeak": 2.3,
        "slope": 3,
        "ca": 0,
        "thal": 6,
    },
}

