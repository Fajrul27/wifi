-- DropIndex
DROP INDEX "Odc_oltPortId_key";

-- AlterTable
ALTER TABLE "Odc" ADD COLUMN     "parentOdcId" INTEGER,
ALTER COLUMN "oltPortId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Odc" ADD CONSTRAINT "Odc_parentOdcId_fkey" FOREIGN KEY ("parentOdcId") REFERENCES "Odc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
