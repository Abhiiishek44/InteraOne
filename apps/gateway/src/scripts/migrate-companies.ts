import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "@shared/infra/database";
import { Account, Contact, Opportunity } from "@shared/models";
import { normalizeAccountName } from "@modules/accounts/accounts.service";

const apply = process.argv.includes("--apply");

async function run() {
  await connectDatabase();
  const contactCandidates = await Contact.find({
    company: { $type: "string", $ne: "" },
    $or: [{ accountId: null }, { accountId: { $exists: false } }],
  }).select("_id organizationId company").lean();
  const opportunityCandidates = await Opportunity.find({
    company: { $type: "string", $ne: "" },
    $or: [{ accountId: null }, { accountId: { $exists: false } }],
  }).select("_id organizationId company contactId primaryContactId").lean();

  const keys = new Map<string, { organizationId: string; name: string }>();
  for (const record of [...contactCandidates, ...opportunityCandidates]) {
    const name = record.company?.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const organizationId = String(record.organizationId);
    keys.set(`${organizationId}:${normalizeAccountName(name)}`, { organizationId, name });
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    companiesToResolve: keys.size,
    contactsToLink: contactCandidates.length,
    opportunitiesToLink: opportunityCandidates.length,
  }, null, 2));
  if (!apply) {
    console.log("No changes made. Re-run with --apply after reviewing these counts.");
    await disconnectDatabase();
    return;
  }

  const accountByKey = new Map<string, any>();
  for (const [key, item] of keys) {
    const normalizedName = normalizeAccountName(item.name);
    const account = await Account.findOneAndUpdate(
      { organizationId: item.organizationId, normalizedName },
      {
        $setOnInsert: {
          organizationId: item.organizationId,
          name: item.name,
          normalizedName,
          lifecycleStage: "prospect",
          tags: [],
          notes: [],
          metadata: { migratedFromLegacyCompany: true },
          lastActivityAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    accountByKey.set(key, account);
  }

  let contactsLinked = 0;
  for (const contact of contactCandidates) {
    const name = contact.company?.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const account = accountByKey.get(`${contact.organizationId}:${normalizeAccountName(name)}`);
    if (!account) continue;
    const result = await Contact.updateOne(
      { _id: contact._id, $or: [{ accountId: null }, { accountId: { $exists: false } }] },
      { $set: { accountId: account._id } },
    );
    contactsLinked += result.modifiedCount;
  }

  let opportunitiesLinked = 0;
  for (const opportunity of opportunityCandidates) {
    const contactId = opportunity.primaryContactId || opportunity.contactId;
    const contact = contactId ? await Contact.findById(contactId).select("accountId").lean() : null;
    let accountId = contact?.accountId;
    if (!accountId) {
      const name = opportunity.company?.trim().replace(/\s+/g, " ");
      if (name) {
        accountId = accountByKey.get(`${opportunity.organizationId}:${normalizeAccountName(name)}`)?._id;
      }
    }
    if (!accountId) continue;
    const result = await Opportunity.updateOne(
      { _id: opportunity._id, $or: [{ accountId: null }, { accountId: { $exists: false } }] },
      {
        $set: {
          accountId,
          ...(contactId ? { primaryContactId: contactId } : {}),
        },
      },
    );
    opportunitiesLinked += result.modifiedCount;
  }

  console.log(JSON.stringify({ companiesResolved: accountByKey.size, contactsLinked, opportunitiesLinked }, null, 2));
  await disconnectDatabase();
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
