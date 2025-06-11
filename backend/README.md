# Patient Health API App - Backend

This README file provides instructions for setting up and running the backend of the Patient Health API application using Flask.

## Prerequisites

Before you begin, ensure you have the following installed:

- Python 3.x
- pip (Python package installer)

## Setup Instructions

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd patient-health-api-app/backend
   ```

2. **Install dependencies:**

   It is recommended to create a virtual environment for your project. You can do this using the following commands:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

   Then install the required packages:

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**

   Set the following environment variables with your OAuth client ID and secret:

   ```bash
   export CLIENT_ID="0oa13xn4aj5jvYcz62p8"
   export CLIENT_SECRET="m9RtrL7ji4JNjtQdq1NbOg0YAUKMwREcv_PShu6WJFcBD4BXg2MKZ6UONPnzbuKQ"
   ```

   On Windows, use `set` instead of `export`.

## Running the Flask Server

To start the Flask server, run the following command:

```bash
python app.py
```

The server will start on `http://127.0.0.1:5000/` by default.

## API Endpoints

- **GET /api/patient**: Retrieve patient information from the Patient Health API.
- **POST /api/auth**: Authenticate using OAuth and retrieve access tokens.

Refer to the API documentation for more details on the endpoints and their usage.

## License

This project is licensed under the MIT License - see the LICENSE file for details.