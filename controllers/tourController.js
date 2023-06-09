// Model
const Tour = require('../models/tourModel');
const devTours = require('../dev-data/data/tours');
// Get all tours
exports.getAllTours = async (req, res) => {
    try {
        // Filtering
        // Query
        const queryObj = { ...req.query };
        // Removing unwanted query items from query string
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach((el) => delete queryObj[el]);
        // Getting tours from db
        // Test cl
        console.log(queryObj)
        // Advanced filtering
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte)\b/g, match => `$${match}`);
        // Test cl
        console.log(JSON.parse(queryStr));
        let query = Tour.find(JSON.parse(queryStr));
        // Sorting
        if(req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            // Test cl
            console.log(sortBy);
            console.log(req.query);
            // Sorting query
            query = query.sort(sortBy);
        } else {
            query = query.sort('price');
        }
        // Limiting
        if(req.query.fields) {
            const fields = req.query.fields.split(',').join(' ');
            query = query.select(fields);
        } else {
            query = query.select('-__v');
        }
        const tours = await query;
        // Test cl
        console.log(req.requestTime);
        res.status(200).json({
            status: 'success',
            data: tours
        });
    } catch(err) {
        res.status(404).json({
            status: 'fail',
            message: err
        });
    }
};
// Create tour
exports.createTour = async (req, res) => {
    try {
        // Creating tour
        const newTour = await Tour.create(req.body);
        res.status(201).json({
            status: 'success',
            data: newTour
        });   
    } catch(err) {
        res.status(400).json({
            status: 'fail',
            message: err
        });
    }

};
// Get single tour
exports.getTour = async(req, res) => {
    try {
        const tour = await Tour.findById(req.params.id);
        res.status(200).json({
            status: 'success',
            data: tour
        });
    } catch(err) {
        res.status(404).json({
            status: 'fail',
            message: err
        });
    }
}
// Get single tour and update
exports.updateTour = async(req, res) => {
    try {
        const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        })
        res.status(200).json({
            status: 'success',
            data: tour
        });
    } catch(err) {
        res.status(404).json({
            status: 'fail',
            message: err
        });
    }
};
// Delete single tour
exports.deletetour = async(req, res) => {
    try {
        const tour = await Tour.findByIdAndDelete(req.params.id);
        res.status(204).json({
            status: 'success',
            data: tour
        });
    } catch(err) {
        res.status(404).json({
            status: 'fail',
            messagE: err
        });
    }
};
// Seed data to database
exports.seedData = async(req, res) => {
    try {
        const tours = await Tour.insertMany(devTours);
        res.status(201).json({
            status: 'success',
            message: 'data inserted'
        })
    } catch(err) {
        res.status(400).json({
            status: 'fail',
            message: err
        })
    }
};
// Alias middleware controller
exports.aliasTopTour = (req, res, next) => {
    req.query.limit = '5';
    req.query.sort = 'price,-ratingAverage';
    req.query.fields = 'name,price,ratingAverage,summary';
    next();
};