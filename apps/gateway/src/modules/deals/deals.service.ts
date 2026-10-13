import { ScopedCrmRecordsService } from "@modules/crm-records";

export class DealsService extends ScopedCrmRecordsService {
  constructor() {
    super("deal");
  }
}
