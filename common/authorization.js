const customerDAO = require("../common/database/dao/customer-dao");
const utility = require("../common/utility");

module.exports = {
    authorize: async function (customerId, allowedPermission, context) {
        try {
            const customerPermissions = await customerDAO.getCustomerPermissions(customerId, context);
            const permissions = customerPermissions[0].permissions.map(p => p.permissionName);
            if (!allowedPermission.every(permission => permissions.includes(permission)))
                throw new utility.createErrorObject("Forbidden", 403);
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}