const Validator = require("jsonschema").Validator;

module.exports = {
    createErrorObject: function (message, status) {
        let err = new Error(message);
        err.status = status;
        return err;
    },
    handleErrorResponse: function (err, res, context) {
        context.log("Error", err);
        res.status(err.status || 500)
            .json({
                message: err.status ? err.message : "Internal Server Error"
            });
    },
    validator: async function (schema, obj, context) {
        try {
            context.log("Validation start");
            context.log("Object", obj);
            if(obj == null)
                throw new this.createErrorObject("Object is undefined", 400);
            context.log("Schema", schema);
            const validator = new Validator();
            const validation = validator.validate(obj, schema)
            if (!validation.valid) 
                throw new this.createErrorObject(validation.errors, 400);
        } catch (err) {
            context.log("Validation error", err);
            throw err;
        }
    }
}