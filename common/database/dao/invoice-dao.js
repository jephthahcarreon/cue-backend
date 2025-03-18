const { connectionPool, sql } = require("../../pool-manager");
const invoiceModel = require("../model/invoice-model");

module.exports = {
    createInvoice: async (orderId, context) => {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            const query = `
                BEGIN TRANSACTION;
                DECLARE @INVOICE_ID INT;
                DECLARE @INVOICE_TOTAL FLOAT;
                BEGIN TRY
                    INSERT INTO dbo.[INVOICE] (ORDER_ID, INVOICE_DATE, INVOICE_STATUS)
                    VALUES (@ORDER_ID, DATEADD(DAY, 30, GETDATE()), 'Billed');
                    SET
                        @INVOICE_ID = SCOPE_IDENTITY();
                    INSERT INTO dbo.[INVOICE_DETAILS] (INVOICE_ID, PRODUCT_ID, QUANTITY, PRICE)
                    SELECT
                        @INVOICE_ID
                        ,OD.PRODUCT_ID
                        ,OD.QUANTITY
                        ,OD.PRICE
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID;
                    SELECT 
                        @INVOICE_TOTAL = SUM(PRICE)
                    FROM dbo.[INVOICE_DETAILS]
                    WHERE INVOICE_ID = @INVOICE_ID;
                    SELECT 
                        I.INVOICE_ID invoiceId
                        ,I.INVOICE_STATUS status
                        ,I.INVOICE_DATE dueDate
                        ,@INVOICE_TOTAL totalCost
                    FROM dbo.[INVOICE] I
                    WHERE I.INVOICE_ID = @INVOICE_ID;
                    COMMIT TRANSACTION;
                END TRY
                BEGIN CATCH
                    ROLLBACK TRANSACTION;
                    THROW;
                END CATCH;
            `;
            const result = await request.query(query)
                .catch(err => {
                    context.log(err);
                    throw err;
                });
            const invoiceSummary = invoiceModel.mapInvoiceSummary(result.recordset);
            return invoiceSummary;
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}