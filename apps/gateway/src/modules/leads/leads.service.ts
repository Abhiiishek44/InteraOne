import { ScopedCrmRecordsService } from "@modules/crm-records";
import { CrmRecord } from "@shared/models";

export class LeadsService extends ScopedCrmRecordsService {
  constructor() {
    super("lead");
  }

  async convertToDealRecord(organizationId: string, leadId: string) {
    const lead = await CrmRecord.exists({
      _id: leadId,
      organizationId,
      recordType: "lead",
      archivedAt: null,
    });
    if (!lead) throw new Error("Lead not found");
    return super.convertToDeal(organizationId, leadId);
  }
}
