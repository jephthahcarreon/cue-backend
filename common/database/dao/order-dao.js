const { query } = require("mssql");
const { connectionPool, sql } = require("../../pool-manager");
const orderModel = require("../model/order-model");

module.exports = {
    createOrder: async function (customerId, userId, items, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("CUSTOMER_ID", sql.Int, customerId)
                .input("USER_ID", sql.Int, userId);
            items.forEach((item, index) => {
                request.input(`PRODUCT_ID_${index}`, sql.Int, item.productId);
                request.input(`PRODUCT_QUANTITY_${index}`, sql.Int, item.quantity)
            });
            const orderItemsParams = items.map((item, index) => `
                (@ORDER_ID
                ,@PRODUCT_ID_${index}
                ,@PRODUCT_QUANTITY_${index})`).join(",");
            const query = `
                BEGIN TRANSACTION;
                DECLARE @ORDER_ID INT;
                DECLARE @ORDER_ITEMS TABLE (ORDER_ID INT, PRODUCT_ID INT, QUANTITY INT);
                BEGIN TRY
                    INSERT INTO dbo.[ORDER] (CUSTOMER_ID, USER_ID, DATE_CREATED, ORDER_STATUS)
                    VALUES (@CUSTOMER_ID, @USER_ID, GETDATE(), 'Pending');
                    SET
                        @ORDER_ID = SCOPE_IDENTITY();
                    INSERT INTO @ORDER_ITEMS
                    VALUES ${orderItemsParams};
                    WITH ORDER_ITEMS_PRICES AS (
                        SELECT
                            OI.ORDER_ID
                            ,OI.PRODUCT_ID
                            ,OI.QUANTITY
                            ,P.PRICE
                            ,OI.QUANTITY * P.PRICE ITEM_TOTAL
                        FROM @ORDER_ITEMS OI
                        INNER JOIN dbo.[PRODUCT] P 
                        ON OI.PRODUCT_ID = P.PRODUCT_ID
                    )
                    INSERT INTO dbo.ORDER_DETAILS (ORDER_ID, PRODUCT_ID, QUANTITY, PRICE)
                    SELECT 
                        OIP.ORDER_ID
                        ,OIP.PRODUCT_ID
                        ,OIP.QUANTITY
                        ,OIP.ITEM_TOTAL
                    FROM ORDER_ITEMS_PRICES OIP;
                    SELECT
                        O.ORDER_ID orderId
                        ,O.ORDER_STATUS status
                        ,SUM(OD.PRICE) totalCost
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID
                    AND OD.IS_DELETED = 0
                    GROUP BY O.ORDER_ID, O.ORDER_STATUS;
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
            const orderSummary = orderModel.mapOrderSummary(result.recordset);
            return orderSummary;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    updateOrder: async function (orderId, items, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            items.forEach((item, index) => {
                request.input(`PRODUCT_ID_${index}`, sql.Int, item.productId);
                request.input(`PRODUCT_QUANTITY_${index}`, sql.Int, item.quantity);
                request.input(`IS_DELETED_${index}`, sql.Bit, item.isDeleted ? 1 : 0);
            });
            const orderUpdatesParams = items.map((item, index) => `
                (@ORDER_ID
                ,@PRODUCT_ID_${index}
                ,@PRODUCT_QUANTITY_${index}
                ,@IS_DELETED_${index})`).join(",");
            let query = `
                BEGIN TRANSACTION;
                BEGIN TRY
                    DECLARE @ORDER_UPDATES TABLE (ORDER_ID INT, PRODUCT_ID INT, QUANTITY INT, IS_DELETED BIT);
                    INSERT INTO @ORDER_UPDATES
                    VALUES ${orderUpdatesParams}
                    MERGE INTO dbo.[ORDER_DETAILS] OD
                    USING (
                        SELECT
                            OU.ORDER_ID
                            ,OU.PRODUCT_ID
                            ,OU.QUANTITY
                            ,OU.IS_DELETED
                            ,P.PRICE
                        FROM @ORDER_UPDATES OU
                        INNER JOIN dbo.[PRODUCT] P 
                        ON OU.PRODUCT_ID = P.PRODUCT_ID
                    ) OUP
                    ON OD.ORDER_ID = OUP.ORDER_ID 
                    AND OD.PRODUCT_ID = OUP.PRODUCT_ID
                    WHEN MATCHED THEN
                        UPDATE SET 
                            OD.QUANTITY = CASE
                                WHEN OUP.IS_DELETED = 0 
                                THEN OUP.QUANTITY 
                                ELSE OD.QUANTITY 
                            END,
                            OD.PRICE = CASE
                                WHEN OUP.IS_DELETED = 0
                                THEN OUP.QUANTITY * OUP.PRICE
                                ELSE OD.PRICE 
                            END,
                            OD.IS_DELETED = CASE
                                WHEN OUP.IS_DELETED = 1
                                THEN 1
                                ELSE OD.IS_DELETED
                            END
                    WHEN NOT MATCHED THEN
                        INSERT (ORDER_ID, PRODUCT_ID, QUANTITY, PRICE, IS_DELETED)
                        VALUES (OUP.ORDER_ID, OUP.PRODUCT_ID, OUP.QUANTITY, OUP.QUANTITY * OUP.PRICE, 0);
                    UPDATE O
                    SET
                        O.DATE_UPDATED = GETDATE()
                    FROM dbo.[ORDER] O
                    WHERE O.ORDER_ID = @ORDER_ID;
                    SELECT
                        O.ORDER_ID orderId
                        ,O.ORDER_STATUS status
                        ,SUM(OD.PRICE) totalCost
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID
                    AND OD.IS_DELETED = 0
                    GROUP BY O.ORDER_ID, O.ORDER_STATUS;
                    COMMIT TRANSACTION;
                END TRY
                BEGIN CATCH
                    ROLLBACK TRANSACTION;
                    THROW;
                END CATCH;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orderSummary = orderModel.mapOrderSummary(result.recordset);
            return orderSummary;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    fulfullOrder: async function (orderId, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            let query = `
                UPDATE O
                SET
                    O.ORDER_STATUS = 'Fulfilled'
                    ,O.DATE_UPDATED = GETDATE()
                FROM dbo.[ORDER] O
                WHERE O.ORDER_ID = @ORDER_ID;
                SELECT
                    O.ORDER_ID orderId
                    ,O.ORDER_STATUS status
                    ,SUM(OD.PRICE) totalCost
                FROM dbo.[ORDER] O
                INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                WHERE O.ORDER_ID = @ORDER_ID
                AND OD.IS_DELETED = 0
                GROUP BY O.ORDER_ID, O.ORDER_STATUS;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orderSummary = orderModel.mapOrderSummary(result.recordset);
            return orderSummary;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    // updateOrder1: async function (orderId, items, context) {
    //     try {
    //         const pool = await connectionPool;
    //         const request = pool.request()
    //             .input("ORDER_ID", sql.Int, orderId);
    //         modifiedItems = items.filter(item => item.isModified);
    //         deletedItems = items.filter(item => item.isDeleted);
    //         const productIds = items.map(item => item.productId).join(",");
    //         let query = `
    //             BEGIN TRANSACTION;
    //             DECLARE @ORDER_TOTAL FLOAT;
    //             DECLARE @ORDER_ITEMS TABLE (PRODUCT_ID INT, QUANTITY INT, PRODUCT_PRICE FLOAT);
    //             BEGIN TRY
    //                 INSERT INTO @ORDER_ITEMS
    //                 SELECT 
    //                     OD.PRODUCT_ID
    //                     ,OD.QUANTITY
    //                     ,P.PRICE
    //                 FROM dbo.[ORDER] O
    //                 INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
    //                 INNER JOIN dbo.[PRODUCT] P ON OD.PRODUCT_ID = P.PRODUCT_ID
    //                 WHERE O.ORDER_ID = @ORDER_ID 
    //                 AND OD.PRODUCT_ID IN (${productIds});
    //                 UPDATE O
    //                 SET
    //                     O.DATE_UPDATED = GETDATE()
    //                 FROM dbo.[ORDER] O
    //                 WHERE O.ORDER_ID = @ORDER_ID;
    //         `;
    //         if (modifiedItems.length) {
    //             query += `
    //                     UPDATE OD
    //                     SET 
    //                         OD.QUANTITY = CASE
    //             `;
    //             modifiedItems.forEach((item, index) => {
    //                 query += `
    //                   WHEN OD.PRODUCT_ID = @MODIFIED_PRODUCT_ID_${index} THEN @PRODUCT_QUANTITY_${index}
    //                   `;
    //                 request.input(`MODIFIED_PRODUCT_ID_${index}`, sql.Int,item.productId);
    //                 request.input(`PRODUCT_QUANTITY_${index}`, sql.Int, item.quantity);
    //             });
    //             query += `
    //                         ELSE OD.QUANTITY
    //                     END,
    //                     OD.PRICE = CASE
    //             `;
    //             modifiedItems.forEach((item, index) => {
    //                 query += `
    //                     WHEN OD.PRODUCT_ID = @MODIFIED_PRODUCT_ID_${index} THEN @PRODUCT_QUANTITY_${index} *
    //                     (SELECT
    //                         PRODUCT_PRICE
    //                     FROM @ORDER_ITEMS
    //                     WHERE PRODUCT_ID = @MODIFIED_PRODUCT_ID_${index})
    //                   `;
    //             });
    //             query += `
    //                         ELSE OD.PRICE
    //                     END
    //             `;
    //         }
    //         if (deletedItems.length) {
    //             if (modifiedItems.length) {
    //                 query += `,
    //                     OD.IS_DELETED = CASE
    //                 `;
    //             } else {
    //                 query += `
    //                         UPDATE OD
    //                         SET 
    //                             OD.IS_DELETED = CASE
    //                 `;
    //             }
    //             deletedItems.forEach((item, index) => {
    //                 query += `
    //                   WHEN OD.PRODUCT_ID = @DELETED_PRODUCT_ID_${index} THEN @IS_DELETED_${index}
    //                   `;
    //                 request.input(`DELETED_PRODUCT_ID_${index}`, sql.Int, item.productId);
    //                 request.input(`IS_DELETED_${index}`, sql.Bit, 1);
    //             });
    //             query += `
    //                         ELSE OD.IS_DELETED
    //                     END
    //             `;
    //         }
    //         query += `
    //                 FROM dbo.[ORDER_DETAILS] OD
    //                 WHERE OD.ORDER_ID = @ORDER_ID
    //                 AND OD.PRODUCT_ID IN (${productIds});
    //                 COMMIT TRANSACTION;
    //             END TRY
    //             BEGIN CATCH
    //                 ROLLBACK TRANSACTION;
    //                 THROW;
    //             END CATCH;
    //         `;
    //         const result = await request.query(query).catch(err => {
    //             context.log(err);
    //             throw err;
    //         });
    //         // const orderSummary = orderModel.mapOrderSummary(result.recordset);
    //         // return orderSummary;
    //     } catch (err) {
    //         context.log(err);
    //         throw err;
    //     }
    // },
    getOrderList: async function (status, startDate, endDate, pageNumber, pageSize, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("STATUS", sql.VarChar(10), status ?? null)
                .input("START_DATE", sql.DateTime, startDate ?? null)
                .input("END_DATE", sql.DateTime, endDate ?? null)
                .input("OFFSET", sql.Int, pageNumber)
                .input("LIMIT", sql.Int, pageSize);
            const query = `
                WITH ORDER_LIST AS (
                    SELECT
                        O.ORDER_ID orderId
                        ,O.ORDER_STATUS status
                        ,O.CUSTOMER_ID customerId
                        ,SUM(OD.PRICE) totalCost 
                        ,O.DATE_CREATED createdDate
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE 
                        (@STATUS IS NULL OR O.ORDER_STATUS = @STATUS)
                        AND (@START_DATE IS NULL OR O.DATE_CREATED >= @START_DATE)
                        AND (@END_DATE IS NULL OR O.DATE_CREATED <= @END_DATE)
                        AND OD.IS_DELETED = 0
                    GROUP BY
                        O.ORDER_ID
                        ,ORDER_STATUS
                        ,CUSTOMER_ID
                        ,DATE_CREATED
                )
                SELECT
                    orderId
                    ,status
                    ,customerId
                    ,totalCost 
                    ,createdDate
                FROM ORDER_LIST
                ORDER BY orderId
                OFFSET (@OFFSET * @LIMIT) ROWS
                FETCH NEXT @LIMIT ROWS ONLY;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orders = orderModel.mapOrders(result.recordset);
            return orders;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    getOrderDetails: async function (orderId, context) {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            const query = `
                WITH ORDER_SUM AS (
                    SELECT
                        O.ORDER_ID
                        ,SUM(OD.PRICE) totalCost
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID
                    AND OD.IS_DELETED = 0
                    GROUP BY O.ORDER_ID
                )
                SELECT
                    O.ORDER_ID orderId
                    ,O.ORDER_STATUS status
                    ,O.CUSTOMER_ID customerId
                    ,OS.totalCost
                    ,O.DATE_CREATED createdDate
                    ,OD.PRODUCT_ID productId
                    ,OD.QUANTITY quantity
                    ,OD.PRICE price
	                ,OD.IS_DELETED isDeleted
                FROM dbo.[ORDER] O
                INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                INNER JOIN ORDER_SUM OS ON O.ORDER_ID = OS.ORDER_ID
                WHERE OD.IS_DELETED = 0
                ORDER BY O.ORDER_ID;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orderDetails = orderModel.mapOrderDetails(result.recordset);
            return orderDetails;
            
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}