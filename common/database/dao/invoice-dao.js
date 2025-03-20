const { connectionPool, sql } = require("../../pool-manager");
const utility = require("../../utility");
const invoiceModel = require("../model/invoice-model");

module.exports = {
    createInvoice: async function (orderId, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            const query = `
                BEGIN TRANSACTION;
                DECLARE @INVOICE_ID INT;
                BEGIN TRY
                    SELECT
                        O.ORDER_ID
                        ,O.ORDER_STATUS
                        ,OD.PRODUCT_ID
                        ,OD.QUANTITY
                        ,OD.PRICE
                    INTO #FULFILLED_ORDER
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID
                    AND O.ORDER_STATUS = 'Fulfilled';
                    IF EXISTS (SELECT 1 FROM #FULFILLED_ORDER)
                    BEGIN
                        INSERT INTO dbo.[INVOICE] (ORDER_ID, INVOICE_DATE, INVOICE_STATUS)
                        VALUES (@ORDER_ID, DATEADD(DAY, 30, GETDATE()), 'Billed');
                        SET
                            @INVOICE_ID = SCOPE_IDENTITY();
                        INSERT INTO dbo.[INVOICE_DETAILS] (INVOICE_ID, PRODUCT_ID, QUANTITY, PRICE)
                        SELECT
                            @INVOICE_ID
                            ,PRODUCT_ID
                            ,QUANTITY
                            ,PRICE
                        FROM #FULFILLED_ORDER
                        SELECT 
                            I.INVOICE_ID invoiceId
                            ,I.INVOICE_STATUS status
                            ,I.INVOICE_DATE dueDate
                            ,SUM(ID.PRICE) totalCost
                        FROM dbo.[INVOICE] I
                        INNER JOIN dbo.[INVOICE_DETAILS] ID ON I.INVOICE_ID = ID.INVOICE_ID
                        WHERE I.INVOICE_ID = @INVOICE_ID
                        GROUP BY I.INVOICE_ID, I.INVOICE_STATUS, I.INVOICE_DATE;
                        COMMIT TRANSACTION;
                    END
                    ELSE
                    BEGIN
                        ROLLBACK TRANSACTION;
                        THROW 50001, 'Order is not fulfilled.', 1;
                    END
                END TRY
                BEGIN CATCH
                    ROLLBACK TRANSACTION;
                    DECLARE @ERROR_MESSAGE NVARCHAR(4000) = ERROR_MESSAGE();
                    DECLARE @ERROR_SEVERITY INT = ERROR_SEVERITY();
                    DECLARE @ERROR_STATE INT = ERROR_STATE();
                    RAISERROR (@ERROR_MESSAGE, @ERROR_SEVERITY, @ERROR_STATE);
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
            if (err.number >= 5000)
                throw new utility.createErrorObject(err, 400);
            else
                throw err;
        }
    }
}