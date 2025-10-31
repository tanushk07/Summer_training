# EACS HR Monitoring System

A comprehensive attendance monitoring and management system built with React frontend and Node.js backend, featuring real-time data visualization and reporting capabilities.

## 🚀 Features

- **Dashboard Analytics**: Real-time attendance statistics and visualizations
- **Employee Management**: Complete employee data management system
- **Leave Management**: Track and manage employee leave applications
- **Punching Data**: Monitor employee check-in/check-out times
- **Monthly Reports**: Generate comprehensive attendance reports
- **Tour Information**: Manage business travel and tour leave applications
- **Data Visualization**: Interactive charts and graphs using Chart.js
- **Responsive Design**: Mobile-friendly interface

## 🛠️ Tech Stack

### Frontend

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Chart.js** - Data visualization
- **Font Awesome** - Icons
- **CSS3** - Styling and responsive design

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQL Server** - Database
- **MSSQL** - Database driver
- **bcrypt** - Password hashing
- **Express Session** - Session management
- **ExcelJS** - Excel file generation

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (v16 or higher)
- **SQL Server** (2016 or higher)
- **npm** or **yarn** package manager
- **Git** for version control

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Human
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

### 4. Environment Configuration

#### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Database Configuration
DB_SERVER=localhost\\SQLEXPRESS
DB_NAME=EmployeeAttendanceDB
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
DB_CONNECTION_TIMEOUT=30000
DB_REQUEST_TIMEOUT=30000

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Server Configuration
PORT=4444
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# API Configuration
API_VERSION=v1
```

#### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:4444
VITE_API_VERSION=v1

# App Configuration
VITE_APP_NAME=EACS Attendance Monitoring
VITE_APP_VERSION=1.0.0

# Environment
VITE_NODE_ENV=development
```

### 5. Database Setup

1. Create a SQL Server database named `EmployeeAttendanceDB`
2. Run the database schema scripts (if available)
3. Update the database connection string in your `.env` file

## 🚀 Running the Application

### Development Mode

#### Start Backend Server

```bash
cd backend
npm start
# or
npm run dev
```

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The application will be available at:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4444

### Production Mode

#### Build Frontend

```bash
cd frontend
npm run build
```

#### Start Production Server

```bash
cd backend
npm start
```

## 📁 Project Structure

```
Human/
├── backend/
│   ├── routes/
│   │   └── api.js          # API routes
│   ├── app.js              # Express app configuration
│   ├── package.json        # Backend dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/         # Page components
│   │   ├── styles/        # CSS files
│   │   └── App.jsx        # Main app component
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies
│   └── .env              # Frontend environment variables
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔐 Security Features

- **Environment Variables**: Sensitive data stored in environment variables
- **Password Hashing**: bcrypt for secure password storage
- **Session Management**: Secure session handling
- **CORS Configuration**: Cross-origin request security
- **Input Validation**: Server-side input validation

## 📊 API Endpoints

### Authentication

- `POST /login` - User login
- `POST /signup` - User registration
- `GET /logout` - User logout

### Dashboard

- `GET /` - Dashboard data
- `GET /api/dashboard` - Dashboard statistics

### Employee Management

- `GET /emp_master` - Employee data
- `GET /leaveinfo` - Leave information
- `GET /punching` - Punching data
- `GET /monthlyreport` - Monthly reports
- `GET /tourinfo` - Tour information

## 🎨 UI Components

- **Dashboard**: Analytics and statistics overview
- **Employee Master**: Employee data management
- **Leave Info**: Leave application tracking
- **Punching Data**: Attendance time tracking
- **Monthly Report**: Comprehensive reporting
- **Tour Info**: Business travel management

## 🔧 Development

### Adding New Features

1. Create new components in `frontend/src/components/`
2. Add new routes in `frontend/src/App.jsx`
3. Create corresponding API endpoints in `backend/routes/api.js`
4. Update environment variables if needed

### Code Style

- Use consistent naming conventions
- Add comments for complex logic
- Follow React best practices
- Use proper error handling

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Check SQL Server is running
   - Verify connection string in `.env`
   - Ensure database exists

2. **Port Already in Use**

   - Change PORT in `.env` file
   - Kill existing processes on the port

3. **Module Not Found**

   - Run `npm install` in both directories
   - Check package.json dependencies

4. **CORS Errors**
   - Verify CORS_ORIGIN in backend `.env`
   - Check frontend API base URL

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

- **v1.0.0** - Initial release with core features
- Dashboard analytics
- Employee management
- Leave tracking
- Report generation

---

**Note**: Make sure to update the environment variables with your actual database credentials and server configurations before running the application.
