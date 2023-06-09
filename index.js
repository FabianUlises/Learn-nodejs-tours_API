// Dependencies
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const AppError = require('./utils/appError');
const cors = require('cors');
const compression = require('compression');
const globalErrorHandler = require('./controllers/errorController');
// App configuration
const app = express();
const dotenv = require('dotenv').config();
// Helmet config
app.use(helmet());
// Cors config
app.use(cors());
app.options('*', cors());
// Middleware
// Data parser, reading data from body into req.body
app.use(express.json());
// Data sanitization against NoSql query injection
app.use(mongoSanitize());
// Data sanitization against xss
app.use(xss());
// Prevent parameter pollution
app.use(hpp({
    whitelist: [
        'duration',
        'ratingsQuantity',
        'ratingsAverage',
        'maxGroupSize',
        'difficulty',
        'price'
    ]
}))
app.use(morgan('dev'));
app.use(compression());
// Rate limiter config
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour'
}); 
app.use('/api', limiter);
// Get requested time and date
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});
// Routes
app.use('/api/v1/tours', require('./routes/tourRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(globalErrorHandler);
module.exports = app;