-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
