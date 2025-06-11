# Patient Health API App

This project is a web application that utilizes the Patient Health API (FHIR) to provide a platform for managing patient health data. It consists of a Flask backend and a JavaScript frontend.

## Project Structure

```
patient-health-api-app
├── backend
│   ├── app.py
│   ├── requirements.txt
│   └── README.md
├── frontend
│   ├── index.html
│   ├── app.js
│   └── README.md
└── README.md
```

## Backend

The backend is built using Flask and serves as the API layer for the application. It handles OAuth authentication and communicates with the Patient Health API.

### Setup Instructions

1. Navigate to the `backend` directory.
2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Run the Flask application:
   ```
   python app.py
   ```

### API Endpoints

- `/api/patient`: Endpoint to retrieve patient data.
- Additional endpoints will be documented in the backend README.

## Frontend

The frontend is built using HTML and JavaScript. It provides a user interface for interacting with the backend API.

### Setup Instructions

1. Open `index.html` in a web browser.
2. Ensure the backend server is running to interact with the API.

## Additional Notes

- Ensure you have the necessary credentials for the Patient Health API (OAuth client ID and secret).
- For any issues or questions, please refer to the documentation in the respective backend and frontend README files.