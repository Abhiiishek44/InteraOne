import { randomUUID } from "crypto";
import { Types } from "mongoose";
import { Account, Contact, Membership, Opportunity } from "@shared/models";
import { CrmFieldsService } from "@modules/crm-fields";
import { serializeCustomFields } from "@shared/utils/custom-fields";

export interface AccountWriteInput {
  name?: string;
  website?: string;
  industry?: string;
  description?: string;
  phone?: string;
  ownerId?: string | null;
  tags?: string[];
  lifecycleStage?: "prospect" | "qualified" | "customer" | "inactive" | "lost";
  customFields?: Record<string, unknown>;
}

export function normalizeAccountName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function domainFromWebsite(website?: string): string | undefined {
  if (!website?.trim()) return undefined;
  try {
    return new URL(website.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export class AccountsService {
  private async validateOwner(organizationId: string, ownerId?: string | null) {
    if (!ownerId) return;
    const exists = await Membership.exists({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(ownerId),
      inviteStatus: "accepted",
    });
    if (!exists)
      throw new Error("Company owner must be an active organization member");
  }

  async list(
    organizationId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      lifecycleStage?: string;
      ownerId?: string;
      includeArchived?: boolean;
    } = {},
  ) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
    };
    if (!options.includeArchived) query.archivedAt = null;
    if (options.lifecycleStage) query.lifecycleStage = options.lifecycleStage;
    if (options.ownerId) query.ownerId = new Types.ObjectId(options.ownerId);
    if (options.search?.trim()) {
      const escaped = options.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [
        { name: regex },
        { domain: regex },
        { industry: regex },
        { tags: regex },
      ];
    }

    const [accounts, total] = await Promise.all([
      Account.find(query)
        .populate("ownerId", "name email")
        .sort({ lastActivityAt: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Account.countDocuments(query),
    ]);
    const ids = accounts.map((account) => account._id);
    const [contactCounts, opportunityStats] = await Promise.all([
      Contact.aggregate([
        {
          $match: {
            organizationId: new Types.ObjectId(organizationId),
            accountId: { $in: ids },
          },
        },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
      Opportunity.aggregate([
        {
          $match: {
            organizationId: new Types.ObjectId(organizationId),
            accountId: { $in: ids },
          },
        },
        {
          $group: {
            _id: "$accountId",
            count: { $sum: 1 },
            value: { $sum: "$value" },
          },
        },
      ]),
    ]);
    const contactsByAccount = new Map(
      contactCounts.map((row) => [String(row._id), row.count]),
    );
    const opportunitiesByAccount = new Map(
      opportunityStats.map((row) => [String(row._id), row]),
    );

    return {
      accounts: accounts.map((account: any) => ({
        id: String(account._id),
        name: account.name,
        website: account.website || "",
        domain: account.domain || "",
        industry: account.industry || "",
        description: account.description || "",
        phone: account.phone || "",
        tags: account.tags || [],
        lifecycleStage: account.lifecycleStage,
        owner: account.ownerId
          ? {
              id: String(account.ownerId._id),
              name: account.ownerId.name,
              email: account.ownerId.email,
            }
          : null,
        contactCount: contactsByAccount.get(String(account._id)) || 0,
        opportunityCount:
          opportunitiesByAccount.get(String(account._id))?.count || 0,
        pipelineValue:
          opportunitiesByAccount.get(String(account._id))?.value || 0,
        lastActivityAt: account.lastActivityAt.toISOString(),
        archivedAt: account.archivedAt?.toISOString() || null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        customFields: serializeCustomFields(account.customFields),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  async get(organizationId: string, accountId: string) {
    const account = await Account.findOne({ _id: accountId, organizationId })
      .populate("ownerId", "name email")
      .lean();
    if (!account) throw new Error("Company not found");

    const [contacts, opportunities] = await Promise.all([
      Contact.find({ organizationId, accountId })
        .populate("ownerId", "name email")
        .sort({ lastActivityAt: -1 })
        .lean(),
      Opportunity.find({ organizationId, accountId })
        .populate("primaryContactId", "name email phone")
        .populate("contactId", "name email phone")
        .populate("ownerId", "name email")
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
    const activity = [
      ...(account.notes || []).map((note) => ({
        id: note.id,
        type: "note",
        content: note.content,
        actor: note.authorName,
        createdAt: note.createdAt.toISOString(),
      })),
      ...contacts.flatMap((contact) =>
        (contact.notes || []).map((note) => ({
          id: `${contact._id}:${note.id}`,
          type: "contact_note",
          content: note.content,
          actor: note.author,
          contact: { id: String(contact._id), name: contact.name },
          createdAt: note.createdAt.toISOString(),
        })),
      ),
      ...opportunities.flatMap((opportunity) =>
        (opportunity.activities || []).map((item) => ({
          id: `${opportunity._id}:${item.id}`,
          type: item.type,
          content: item.content,
          opportunity: {
            id: String(opportunity._id),
            title: opportunity.title,
          },
          createdAt: item.createdAt.toISOString(),
        })),
      ),
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

    return {
      account: {
        id: String(account._id),
        name: account.name,
        website: account.website || "",
        domain: account.domain || "",
        industry: account.industry || "",
        description: account.description || "",
        phone: account.phone || "",
        tags: account.tags || [],
        lifecycleStage: account.lifecycleStage,
        owner:
          account.ownerId && typeof account.ownerId === "object"
            ? {
                id: String((account.ownerId as any)._id),
                name: (account.ownerId as any).name,
                email: (account.ownerId as any).email,
              }
            : null,
        archivedAt: account.archivedAt?.toISOString() || null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        customFields: serializeCustomFields(account.customFields),
      },
      contacts: contacts.map((contact: any) => ({
        id: String(contact._id),
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
        lifecycleStage: contact.lifecycleStage,
        owner: contact.ownerId
          ? { id: String(contact.ownerId._id), name: contact.ownerId.name }
          : null,
        lastActivityAt: contact.lastActivityAt.toISOString(),
      })),
      opportunities: opportunities.map((opportunity: any) => {
        const primaryContact =
          opportunity.primaryContactId || opportunity.contactId;
        return {
          id: String(opportunity._id),
          title: opportunity.title,
          value: opportunity.value,
          currency: opportunity.currency,
          stage: opportunity.stage,
          nextAction: opportunity.nextAction || "",
          primaryContact: primaryContact
            ? { id: String(primaryContact._id), name: primaryContact.name }
            : null,
          owner: opportunity.ownerId
            ? {
                id: String(opportunity.ownerId._id),
                name: opportunity.ownerId.name,
              }
            : null,
          updatedAt: opportunity.updatedAt.toISOString(),
        };
      }),
      activity: activity.slice(0, 200),
    };
  }

  async create(
    organizationId: string,
    userId: string,
    input: AccountWriteInput,
  ) {
    await this.validateOwner(organizationId, input.ownerId);
    const customFields = await new CrmFieldsService().validateValues(
      organizationId,
      "accounts",
      input.customFields,
      true,
    );
    const name = input.name!.trim().replace(/\s+/g, " ");
    return Account.create({
      organizationId: new Types.ObjectId(organizationId),
      name,
      normalizedName: normalizeAccountName(name),
      website: input.website?.trim() || undefined,
      domain: domainFromWebsite(input.website),
      industry: input.industry?.trim() || undefined,
      description: input.description?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      ownerId: input.ownerId ? new Types.ObjectId(input.ownerId) : null,
      tags: [
        ...new Set(
          (input.tags || [])
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
      lifecycleStage: input.lifecycleStage || "prospect",
      createdBy: new Types.ObjectId(userId),
      lastActivityAt: new Date(),
      customFields,
    });
  }

  async update(
    organizationId: string,
    accountId: string,
    input: AccountWriteInput,
  ) {
    await this.validateOwner(organizationId, input.ownerId);
    if (input.customFields !== undefined) {
      input.customFields = await new CrmFieldsService().validateValues(
        organizationId,
        "accounts",
        input.customFields,
      );
    }
    const set: Record<string, unknown> = {
      ...input,
      lastActivityAt: new Date(),
    };
    if (input.name !== undefined) {
      set.name = input.name.trim().replace(/\s+/g, " ");
      set.normalizedName = normalizeAccountName(input.name);
    }
    if (input.website !== undefined)
      set.domain = domainFromWebsite(input.website);
    if (input.ownerId !== undefined)
      set.ownerId = input.ownerId ? new Types.ObjectId(input.ownerId) : null;
    if (input.tags !== undefined)
      set.tags = [
        ...new Set(
          input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        ),
      ];
    const account = await Account.findOneAndUpdate(
      { _id: accountId, organizationId },
      { $set: set },
      { new: true, runValidators: true },
    );
    if (!account) throw new Error("Company not found");
    if (input.name !== undefined) {
      await Promise.all([
        Contact.updateMany(
          {
            organizationId: new Types.ObjectId(organizationId),
            accountId: account._id,
          },
          { $set: { company: account.name } },
        ),
        Opportunity.updateMany(
          {
            organizationId: new Types.ObjectId(organizationId),
            accountId: account._id,
          },
          { $set: { company: account.name } },
        ),
      ]);
    }
    return account;
  }

  async archive(organizationId: string, accountId: string) {
    const account = await Account.findOneAndUpdate(
      { _id: accountId, organizationId },
      { $set: { archivedAt: new Date() } },
      { new: true },
    );
    if (!account) throw new Error("Company not found");
  }

  async addNote(
    organizationId: string,
    accountId: string,
    user: { userId: string; email: string },
    content: string,
  ) {
    const note = {
      id: randomUUID(),
      authorId: new Types.ObjectId(user.userId),
      authorName: user.email,
      content: content.trim(),
      createdAt: new Date(),
    };
    const account = await Account.findOneAndUpdate(
      { _id: accountId, organizationId },
      {
        $push: { notes: { $each: [note], $position: 0 } },
        $set: { lastActivityAt: new Date() },
      },
      { new: true },
    );
    if (!account) throw new Error("Company not found");
    return note;
  }
}
