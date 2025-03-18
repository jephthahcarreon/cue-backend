const Validator = require("jsonschema").Validator;

module.exports = {
    validator: async (schema, obj, context) => {
        try {
            context.log("Validation start");
            context.log("Object: ", obj);
            if(obj == null)
                throw new Error("Object is undefined", 400);
            context.log("Schema: ", schema);
            const validator = new Validator();
            const validation = validator.validate(obj, schema)
            if (!validation.valid) 
                throw new Error(validation.errors, 400);
        } catch (err) {
            context.log("Validation error:");
            context.log(err);
            throw err;
        }
    }
}