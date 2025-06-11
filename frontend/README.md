# Patient Health API App - Frontend

This directory contains the frontend application for the Patient Health API project. The frontend is built using HTML and JavaScript and interacts with the Flask backend to access patient health data.

## Setup Instructions

1. **Clone the Repository**: 
   Clone the repository to your local machine using:
   ```
   git clone <repository-url>
   ```

2. **Navigate to the Frontend Directory**:
   Change into the frontend directory:
   ```
   cd patient-health-api-app/frontend
   ```

3. **Open the HTML File**:
   Open `index.html` in your preferred web browser to view the application.

## Running the Frontend Application

The frontend application does not require a specific server to run. You can simply open the `index.html` file in a web browser. However, for a better development experience, consider using a local server.

### Using a Local Server

You can use a simple HTTP server to serve the files. If you have Python installed, you can run the following command in the frontend directory:

For Python 3:
```
python -m http.server
```

Then, navigate to `http://localhost:8000` in your web browser.

## Interacting with the Backend

The frontend communicates with the Flask backend to fetch and display patient health data. Ensure that the backend server is running and accessible at the specified endpoint.

## Additional Notes

- Make sure to check the backend's README.md for details on API endpoints and authentication requirements.
- This frontend is designed to work seamlessly with the provided backend and should be tested in conjunction with it.