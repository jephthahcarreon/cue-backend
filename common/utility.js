const Validator = require("jsonschema").Validator;



module.exports = {
    handleErrorResponse: (err, res, context) => {
        context.log("Error", err);
        res.status(err.status || 500)
            .json({
                message: err.status ? err.message : "Internal Server Error"
            });
    },
    validator: async (schema, obj, context) => {
        try {
            context.log("Validation start");
            context.log("Object", obj);
            if(obj == null)
                throw new Error("Object is undefined", { status: 400 });
            context.log("Schema", schema);
            const validator = new Validator();
            const validation = validator.validate(obj, schema)
            if (!validation.valid) 
                throw new Error(validation.errors, { status: 400 });
        } catch (err) {
            context.log("Validation error", err);
            throw err;
        }
    }
}