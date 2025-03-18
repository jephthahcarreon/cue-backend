const { connectionPool, sql } = require("../../pool-manager");
const customerModel = require("../model/customer-model");

module.exports = {
    getCustomerPermissions: async function (customerId, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("CUSTOMER_ID", sql.Int, customerId);
            const query = `
                SELECT
                    U.USER_ID userId
                    ,C.CUSTOMER_ID customerId
                    ,P.PERMISSION_ID permissionId
                    ,P.NAME permissionName
                FROM dbo.[USER] U
                INNER JOIN dbo.[CUSTOMER_USER_MAP] CU ON U.USER_ID = CU.USER_ID
                INNER JOIN dbo.[CUSTOMER] C ON C.CUSTOMER_ID = CU.CUSTOMER_ID
                INNER JOIN dbo.[ROLE] R ON R.ROLE_ID = CU.ROLE_ID
                INNER JOIN dbo.[ROLE_PERMISSION_MAP] RPM ON R.ROLE_ID = RPM.ROLE_ID
                INNER JOIN dbo.[PERMISSION] P ON P.PERMISSION_ID = RPM.PERMISSION_ID
                WHERE C.CUSTOMER_ID = @CUSTOMER_ID;
            `;
            const result = await request.query(query)
                .catch(err => {
                    context.log(err);
                    throw err;
                });
            const permissions = customerModel.mapCustomerPermissions(result.recordset);
            return permissions;
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}