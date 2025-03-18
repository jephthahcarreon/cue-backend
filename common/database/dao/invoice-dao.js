const { connectionPool, sql } = require("../../pool-manager");
const invoiceModel = require("../model/invoice-model");

module.exports = {
    createInvoice: async (orderId, context) => {
        try {
            const pool = await connectionPool;
            const request = pool.request();
            const query = `
            
            `;
            const result = request.query(query)
                .catch(err => {
                    context.log(err);
                    throw err
                });
            const invoiceSummary = invoiceModel.mapInvoiceSummary(result.recordset);
            return invoiceSummary;
            
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}