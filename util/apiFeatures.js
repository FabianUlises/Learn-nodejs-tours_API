class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }
    filter() {
        // Filtering
        // Query
        const queryObj = { ...this.queryString };
        // Removing unwanted query items from query string
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach((el) => delete queryObj[el]);
        // Advanced filtering
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte)\b/g, match => `$${match}`);
        this.query = this.query.find(JSON.parse(queryStr));
        return this;
    }
    sort() {
        // Sorting
        if(this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            // Sorting query
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('price');
        }
        return this;
    }
    limitFields() {
        // Limiting
        if(this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }
        return this;
    }
};
module.exports = APIFeatures;