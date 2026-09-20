import { Types } from "mongoose";
import { randomUUID } from "crypto";
import {
  Contact,
  Conversation,
  Message,
  ContactConflict,
  Membership,
} from "@shared/models";
import {
  ContactWriteInput,
  ListContactsOptions,
  UpsertFromAIInput,
} from "./contacts.types";
import logger from "@shared/core/logger";

export class ContactsService {
  async listContacts(
    organizationId: string,
    options: ListContactsOptions = {},
  ) {
    const limit = Math.min(Math.max(options.limit || 100, 1), 300);
    const query: Record<string, unknown> = { organizationId };

    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = new RegExp(term, "i");
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { company: regex },
      ];
    }

    if (options.lifecycleStage) query.lifecycleStage = options.lifecycleStage;
    if (options.leadStatus) query.leadStatus = options.leadStatus;
    if (options.ownerId) query.ownerId = new Types.ObjectId(options.ownerId);
    if (options.followUp === "overdue") {
      query.nextFollowUpAt = { $ne: null, $lt: new Date() };
    } else if (options.followUp === "upcoming") {
      query.nextFollowUpAt = { $gte: new Date() };
    }

    const contacts = await Contact.find(query)
      .populate("ownerId", "name email")
      .sort({ lastActivityAt: -1 })
      .limit(limit)
      .lean();

    const sessionIds = contacts.map((c) => c.sessionId).filter(Boolean);
    const emails = contacts.map((c) => c.email).filter(Boolean);
    const phones = contacts.map((c) => c.phone).filter(Boolean);

    // Query actual recent conversations matching sessionId, email, or phone number
    const conversations = await Conversation.find({
      organizationId: new Types.ObjectId(organizationId),
      $or: [
        { sessionId: { $in: sessionIds } },
        ...(emails.length > 0
          ? [
              { "metadata.customer.email": { $in: emails } },
              { "metadata.senderEmail": { $in: emails } },
            ]
          : []),
        ...(phones.length > 0
          ? [
              { "metadata.customer.phone": { $in: phones } },
              { "metadata.visitorPhone": { $in: phones } },
            ]
          : []),
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const convIds = conversations.map((c) => c._id);
    // Find the earliest message for each conversation
    const messages = await Message.find({
      organizationId: new Types.ObjectId(organizationId),
      conversationId: { $in: convIds },
    })
      .sort({ createdAt: 1 })
      .lean();

    const firstMessageMap = new Map<string, string>();
    for (const msg of messages) {
      const cid = msg.conversationId.toString();
      if (!firstMessageMap.has(cid)) {
        firstMessageMap.set(cid, msg.content);
      }
    }

    // Helper to filter conversations for a specific contact
    const getContactConversations = (contact: any) => {
      return conversations.filter((conv) => {
        if (contact.sessionId && conv.sessionId === contact.sessionId)
          return true;

        const convEmail =
          conv.metadata?.customer?.email || conv.metadata?.senderEmail;
        if (
          contact.email &&
          convEmail &&
          convEmail.toLowerCase() === contact.email.toLowerCase()
        )
          return true;

        const convPhone =
          conv.metadata?.customer?.phone || conv.metadata?.visitorPhone;
        if (contact.phone && convPhone && convPhone === contact.phone)
          return true;

        return false;
      });
    };

    // Query pending conflicts for all contacts
    const pendingConflicts = await ContactConflict.find({
      organizationId: new Types.ObjectId(organizationId),
      status: "pending",
    }).lean();

    const conflictsMap = new Map<string, any[]>();
    for (const c of pendingConflicts) {
      const cId = c.contactId.toString();
      if (!conflictsMap.has(cId)) {
        conflictsMap.set(cId, []);
      }
      conflictsMap.get(cId)!.push({
        id: c._id.toString(),
        field: c.field,
        currentValue: c.currentValue,
        proposedValue: c.proposedValue,
        conversationId: c.conversationId.toString(),
        createdAt: c.createdAt.toISOString(),
      });
    }

    return contacts.map((contact) => {
      const contactConversations = getContactConversations(contact);
      const contactConflicts = conflictsMap.get(contact._id.toString()) || [];

      const convListItems = contactConversations.map((conv) => {
        const firstMsg =
          firstMessageMap.get(conv._id.toString()) ||
          conv.subject ||
          "Conversation context is still syncing.";
        return {
          id: conv._id.toString(),
          status: conv.status,
          lastMessage: firstMsg,
          channel: conv.channel || conv.metadata?.source || "widget",
          updatedAt: conv.updatedAt.toISOString(),
        };
      });

      const convTags = contactConversations.flatMap((c) => c.tags || []);

      // Combine contact's tags and all associated conversation tags
      const combinedTags = [...(contact.tags || []), ...convTags];

      // Normalize (lowercase, trimmed) and deduplicate
      const aggregatedTags = Array.from(
        new Set(
          combinedTags
            .map((tag) =>
              String(tag || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      );

      let lastActivityAt = contact.lastActivityAt || contact.updatedAt;
      if (contactConversations.length > 0) {
        const maxUpdated = new Date(
          Math.max(
            ...contactConversations.map((c) => new Date(c.updatedAt).getTime()),
          ),
        );
        if (maxUpdated > lastActivityAt) {
          lastActivityAt = maxUpdated;
        }
      }

      return {
        id: contact._id.toString(),
        sessionId: contact.sessionId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        tags: aggregatedTags,
        source: contact.source,
        lifecycleStage: contact.lifecycleStage || "new",
        leadStatus: contact.leadStatus || "needs_review",
        owner:
          contact.ownerId && typeof contact.ownerId === "object"
            ? {
                id: String((contact.ownerId as any)._id),
                name: (contact.ownerId as any).name || "Unknown member",
                email: (contact.ownerId as any).email || "",
              }
            : null,
        acquisitionSource: contact.acquisitionSource || "unknown",
        preferredChannel: contact.preferredChannel || null,
        nextFollowUpAt: contact.nextFollowUpAt?.toISOString() || null,
        lastContactedAt: contact.lastContactedAt?.toISOString() || null,
        notes: (contact.notes || []).map((note: any) => ({
          id: note.id,
          author: note.author,
          content: note.content,
          createdAt: new Date(note.createdAt).toISOString(),
        })),
        conversations: convListItems,
        conflicts: contactConflicts,
        insights: {
          summary: contact.insights?.summary || "No insights yet.",
          sentiment: contact.insights?.sentiment || "neutral",
          topics: contact.insights?.topics || [],
        },
        conversationCount: contactConversations.length,
        lastActivity: lastActivityAt.toISOString(),
        createdAt: (contact.createdAt || contact.updatedAt).toISOString(),
        updatedAt: (contact.updatedAt || contact.createdAt).toISOString(),
      };
    });
  }

  private async validateOwner(
    organizationId: string,
    ownerId?: string | null,
  ): Promise<void> {
    if (!ownerId) return;
    const membership = await Membership.exists({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(ownerId),
      inviteStatus: "accepted",
    });
    if (!membership)
      throw new Error("Contact owner must be an active organization member");
  }

  async listContactOwners(organizationId: string): Promise<any[]> {
    const memberships = await Membership.find({
      organizationId: new Types.ObjectId(organizationId),
      inviteStatus: "accepted",
    })
      .populate("userId", "name email isActive")
      .sort({ role: 1, createdAt: 1 })
      .lean();

    return memberships
      .filter((membership: any) => membership.userId?.isActive !== false)
      .map((membership: any) => ({
        id: String(membership.userId._id),
        name: membership.userId.name || membership.userId.email,
        email: membership.userId.email,
        role: membership.role,
      }));
  }

  async createContact(
    organizationId: string,
    data: ContactWriteInput,
    source: "agent" | "admin" | "owner",
  ): Promise<any> {
    await this.validateOwner(organizationId, data.ownerId);

    const tags = (data.tags || [])
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const contact = await Contact.create({
      organizationId: new Types.ObjectId(organizationId),
      sessionId: `manual:${randomUUID()}`,
      name: data.name?.trim(),
      ...(data.email?.trim() ? { email: data.email.trim().toLowerCase() } : {}),
      ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
      ...(data.company?.trim() ? { company: data.company.trim() } : {}),
      tags,
      source,
      lifecycleStage: data.lifecycleStage || "new",
      leadStatus: data.leadStatus || "needs_review",
      ownerId: data.ownerId ? new Types.ObjectId(data.ownerId) : null,
      acquisitionSource: data.acquisitionSource || "manual",
      preferredChannel: data.preferredChannel || null,
      nextFollowUpAt: data.nextFollowUpAt
        ? new Date(data.nextFollowUpAt)
        : null,
      lastContactedAt: data.lastContactedAt
        ? new Date(data.lastContactedAt)
        : null,
      lastActivityAt: new Date(),
    });

    return contact;
  }

  async upsertFromAI(input: UpsertFromAIInput) {
    const { organizationId, conversationId } = input;

    if (!Types.ObjectId.isValid(conversationId)) {
      throw new Error("Invalid conversationId");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId,
    });

    if (!conversation) {
      throw new Error("Conversation not found for organization");
    }

    const sessionId = conversation.sessionId || `conv:${conversationId}`;
    const existingName = "";
    const existingEmail = "";

    const resolvedName = (
      input.name ||
      existingName ||
      "Anonymous User"
    ).trim();
    const resolvedEmail = (input.email || existingEmail || "")
      .trim()
      .toLowerCase();
    const resolvedPhone = (input.phone || "").trim();
    const normalizedTags = (input.tags || [])
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .slice(0, 20);
    const normalizedTopics = (input.topics || [])
      .map((topic) => String(topic || "").trim())
      .filter(Boolean)
      .slice(0, 20);
    const sentiment =
      input.sentiment &&
      ["positive", "neutral", "negative"].includes(input.sentiment)
        ? input.sentiment
        : undefined;
    const note = (input.note || "").trim();
    const company = (input.company || "").trim();
    const conversationChannel = String(
      conversation.channel || conversation.metadata?.source || "unknown",
    ).toLowerCase();
    const supportedChannels = ["widget", "email", "whatsapp", "telegram"];
    const acquisitionSource = supportedChannels.includes(conversationChannel)
      ? conversationChannel
      : "unknown";

    const conversationUpdate: Record<string, unknown> = {
      "metadata.contactCapturedByAIAt": new Date(),
      "metadata.contactCapturedByAI": true,
      "metadata.analyzed": true,
      "metadata.analyzedAt": new Date(),
      "metadata.insights": {
        summary: input.summary || "No insights yet.",
        sentiment: sentiment || "neutral",
        topics: normalizedTopics,
      },
    };

    if (resolvedEmail) {
      conversationUpdate["metadata.senderEmail"] = resolvedEmail;
    }
    conversationUpdate["metadata.senderName"] = resolvedName;
    if (resolvedPhone) {
      conversationUpdate["metadata.visitorPhone"] = resolvedPhone;
    }

    await Conversation.updateOne(
      { _id: conversationId },
      { $set: conversationUpdate },
    );

    const orgObjectId = new Types.ObjectId(organizationId);

    // 1. Find target contact to update (prioritize email to merge returning sessions, fallback to sessionId)
    let contactDoc = null;
    if (resolvedEmail) {
      contactDoc = await Contact.findOne({
        organizationId: orgObjectId,
        email: resolvedEmail,
      });
    }
    if (!contactDoc) {
      contactDoc = await Contact.findOne({
        organizationId: orgObjectId,
        sessionId,
      });
    }

    // Do not create a Contact document for anonymous conversations (no existing contact and no email/phone)
    if (!contactDoc && !resolvedEmail && !resolvedPhone) {
      logger.debug(
        `[upsertFromAI] Conversation ${conversationId} is anonymous and has no existing contact. Skipping contact creation.`,
      );
      return;
    }

    // 2. Determine proposed fields and detect conflicts against target contact details
    let finalName = resolvedName;
    let finalPhone = resolvedPhone;
    let finalCompany = company;

    if (contactDoc) {
      // Check Name mismatch
      if (
        resolvedName &&
        resolvedName !== "Anonymous User" &&
        contactDoc.name &&
        contactDoc.name !== "Anonymous User" &&
        contactDoc.name !== resolvedName
      ) {
        finalName = contactDoc.name; // Retain current
        const exists = await ContactConflict.findOne({
          contactId: contactDoc._id,
          field: "name",
          proposedValue: resolvedName,
          status: "pending",
        });
        if (!exists) {
          await ContactConflict.create({
            organizationId: orgObjectId,
            contactId: contactDoc._id,
            field: "name",
            currentValue: contactDoc.name,
            proposedValue: resolvedName,
            conversationId: new Types.ObjectId(conversationId),
            status: "pending",
          });
        }
      } else if (!contactDoc.name || contactDoc.name === "Anonymous User") {
        finalName = resolvedName || contactDoc.name;
      } else {
        finalName = contactDoc.name;
      }

      // Check Phone mismatch
      if (
        resolvedPhone &&
        contactDoc.phone &&
        contactDoc.phone !== resolvedPhone
      ) {
        finalPhone = contactDoc.phone; // Retain current
        const exists = await ContactConflict.findOne({
          contactId: contactDoc._id,
          field: "phone",
          proposedValue: resolvedPhone,
          status: "pending",
        });
        if (!exists) {
          await ContactConflict.create({
            organizationId: orgObjectId,
            contactId: contactDoc._id,
            field: "phone",
            currentValue: contactDoc.phone,
            proposedValue: resolvedPhone,
            conversationId: new Types.ObjectId(conversationId),
            status: "pending",
          });
        }
      } else {
        finalPhone = resolvedPhone || contactDoc.phone || "";
      }

      // Check Company mismatch
      if (company && contactDoc.company && contactDoc.company !== company) {
        finalCompany = contactDoc.company; // Retain current
        const exists = await ContactConflict.findOne({
          contactId: contactDoc._id,
          field: "company",
          proposedValue: company,
          status: "pending",
        });
        if (!exists) {
          await ContactConflict.create({
            organizationId: orgObjectId,
            contactId: contactDoc._id,
            field: "company",
            currentValue: contactDoc.company,
            proposedValue: company,
            conversationId: new Types.ObjectId(conversationId),
            status: "pending",
          });
        }
      } else {
        finalCompany = company || contactDoc.company || "";
      }
    }

    const query = contactDoc
      ? { _id: contactDoc._id }
      : { organizationId: orgObjectId, sessionId };

    const systemNotes = [];
    if (note) {
      systemNotes.push({
        id: `note-${Date.now()}`,
        author: "AI Assistant",
        content: note,
        createdAt: new Date(),
      });
    }

    const contact = await Contact.findOneAndUpdate(
      query,
      {
        $set: {
          organizationId: orgObjectId,
          sessionId,
          conversationId,
          name: finalName,
          ...(resolvedEmail ? { email: resolvedEmail } : {}),
          ...(finalPhone ? { phone: finalPhone } : {}),
          ...(finalCompany ? { company: finalCompany } : {}),
          ...(sentiment || input.summary || normalizedTopics.length > 0
            ? {
                insights: {
                  summary: input.summary || "No insights yet.",
                  sentiment: sentiment || "neutral",
                  topics: normalizedTopics,
                },
              }
            : {}),
          source: "ai",
          lastActivityAt: new Date(),
          metadata: {
            updatedBy: "ai_tool",
            conversationId,
          },
        },
        $setOnInsert: {
          lifecycleStage: "new",
          leadStatus: "needs_review",
          acquisitionSource,
          preferredChannel:
            acquisitionSource === "unknown" ? null : acquisitionSource,
        },
        ...(normalizedTags.length > 0
          ? {
              $addToSet: {
                tags: { $each: normalizedTags },
              },
            }
          : {}),
        ...(systemNotes.length > 0
          ? {
              $push: {
                notes: {
                  $each: systemNotes,
                  $position: 0,
                },
              },
            }
          : {}),
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    if (!contact) {
      throw new Error("Failed to upsert contact");
    }

    return {
      id: contact._id.toString(),
      sessionId: contact.sessionId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      tags: contact.tags || [],
      source: contact.source,
      lifecycleStage: contact.lifecycleStage || "new",
      leadStatus: contact.leadStatus || "needs_review",
      owner: null,
      acquisitionSource: contact.acquisitionSource || "unknown",
      preferredChannel: contact.preferredChannel || null,
      nextFollowUpAt: contact.nextFollowUpAt?.toISOString() || null,
      lastContactedAt: contact.lastContactedAt?.toISOString() || null,
      notes: (contact.notes || []).map((note: any) => ({
        id: note.id,
        author: note.author,
        content: note.content,
        createdAt: new Date(note.createdAt).toISOString(),
      })),
      conversations: (contact.conversations || []).map((conversation: any) => ({
        id: conversation.id,
        status: conversation.status,
        lastMessage: conversation.lastMessage,
        channel:
          conversation.channel || conversation.metadata?.source || "widget",
        updatedAt: new Date(conversation.updatedAt).toISOString(),
      })),
      insights: {
        summary: contact.insights?.summary || "No insights yet.",
        sentiment: contact.insights?.sentiment || "neutral",
        topics: contact.insights?.topics || [],
      },
      createdAt: (
        contact.createdAt ||
        contact.updatedAt ||
        new Date()
      ).toISOString(),
      updatedAt: (
        contact.updatedAt ||
        contact.createdAt ||
        new Date()
      ).toISOString(),
    };
  }

  async deleteContacts(
    organizationId: string,
    ids: string[],
  ): Promise<{ deletedCount: number }> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const result = await Contact.deleteMany({
      organizationId: new Types.ObjectId(organizationId),
      _id: { $in: objectIds },
    });

    // Delete associated contact conflicts to avoid orphaned data
    try {
      await ContactConflict.deleteMany({
        organizationId: new Types.ObjectId(organizationId),
        contactId: { $in: objectIds },
      });
    } catch (err: any) {
      logger.warn(
        `[deleteContacts] Failed to delete associated contact conflicts: ${err.message}`,
      );
    }

    return { deletedCount: result.deletedCount || 0 };
  }

  async bulkAddTags(
    organizationId: string,
    ids: string[],
    tags: string[],
  ): Promise<{ modifiedCount: number }> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const result = await Contact.updateMany(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: { $in: objectIds },
      },
      {
        $addToSet: {
          tags: {
            $each: tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
          },
        },
      },
    );
    return { modifiedCount: result.modifiedCount || 0 };
  }

  async addNote(
    organizationId: string,
    contactId: string,
    author: string,
    content: string,
  ): Promise<any> {
    const note = {
      id: `note-${Date.now()}`,
      author,
      content,
      createdAt: new Date(),
    };
    const updated = await Contact.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
      },
      {
        $push: { notes: { $each: [note], $position: 0 } },
      },
      { new: true },
    );
    if (!updated) throw new Error("Contact not found");
    return note;
  }

  async updateNote(
    organizationId: string,
    contactId: string,
    noteId: string,
    content: string,
  ): Promise<any> {
    const updated = await Contact.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
        "notes.id": noteId,
      },
      {
        $set: { "notes.$.content": content },
      },
      { new: true },
    ).lean();

    if (!updated) throw new Error("Contact note not found");

    const note = updated.notes.find((item) => item.id === noteId);
    if (!note) throw new Error("Contact note not found");

    return {
      id: note.id,
      author: note.author,
      content: note.content,
      createdAt: new Date(note.createdAt).toISOString(),
    };
  }

  async deleteNote(
    organizationId: string,
    contactId: string,
    noteId: string,
  ): Promise<void> {
    const result = await Contact.updateOne(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
        "notes.id": noteId,
      },
      {
        $pull: { notes: { id: noteId } },
      },
    );

    if (result.modifiedCount === 0) throw new Error("Contact note not found");
  }

  async addTag(
    organizationId: string,
    contactId: string,
    tag: string,
  ): Promise<string> {
    // Normalize: trim whitespace and lowercase so stored value matches UI display
    const cleanedTag = tag.trim().toLowerCase();
    if (!cleanedTag) throw new Error("Tag cannot be empty");
    const updated = await Contact.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
      },
      {
        $addToSet: { tags: cleanedTag },
      },
      { new: true },
    );
    if (!updated) throw new Error("Contact not found");
    return cleanedTag;
  }

  async removeTag(
    organizationId: string,
    contactId: string,
    tag: string,
  ): Promise<void> {
    // Normalize the tag the same way it was stored: trim + lowercase
    const normalizedTag = tag.trim().toLowerCase();
    const updated = await Contact.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
      },
      {
        $pull: { tags: normalizedTag },
      },
      { new: true },
    );
    if (!updated) throw new Error("Contact not found");
  }

  async listPendingConflicts(organizationId: string): Promise<any[]> {
    const conflicts = await ContactConflict.find({
      organizationId: new Types.ObjectId(organizationId),
      status: "pending",
    })
      .populate("contactId", "name email phone company")
      .sort({ createdAt: -1 })
      .lean();

    return conflicts.map((c: any) => ({
      id: c._id.toString(),
      contactId: c.contactId?._id?.toString() || "",
      contactName: c.contactId?.name || "Unknown",
      contactEmail: c.contactId?.email || "",
      field: c.field,
      currentValue: c.currentValue,
      proposedValue: c.proposedValue,
      conversationId: c.conversationId.toString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async resolveConflict(
    organizationId: string,
    conflictId: string,
    action: "apply" | "dismiss",
    agentName: string,
  ): Promise<void> {
    const conflict = await ContactConflict.findOne({
      _id: new Types.ObjectId(conflictId),
      organizationId: new Types.ObjectId(organizationId),
      status: "pending",
    });

    if (!conflict) {
      throw new Error("Conflict not found or already resolved");
    }

    if (action === "apply") {
      // Overwrite primary contact field
      const updateField = { [conflict.field]: conflict.proposedValue };
      const updatedContact = await Contact.findOneAndUpdate(
        {
          _id: conflict.contactId,
          organizationId: new Types.ObjectId(organizationId),
        },
        {
          $set: updateField,
        },
        { new: true },
      );
      if (!updatedContact) {
        throw new Error("Target contact not found");
      }

      // Mark other identical pending conflicts for this contact/field as resolved too
      await ContactConflict.updateMany(
        {
          contactId: conflict.contactId,
          field: conflict.field,
          status: "pending",
        },
        {
          $set: {
            status: "resolved",
            resolvedAt: new Date(),
            resolvedBy: agentName,
          },
        },
      );
    } else {
      // Dismiss
      conflict.status = "dismissed";
      conflict.resolvedAt = new Date();
      conflict.resolvedBy = agentName;
      await conflict.save();
    }
  }

  async updateContact(
    organizationId: string,
    contactId: string,
    data: ContactWriteInput,
  ): Promise<any> {
    await this.validateOwner(organizationId, data.ownerId);
    const {
      name,
      email,
      phone,
      company,
      tags,
      lifecycleStage,
      leadStatus,
      ownerId,
      acquisitionSource,
      preferredChannel,
      nextFollowUpAt,
      lastContactedAt,
    } = data;
    const updateFields: any = {};
    const unsetFields: Record<string, 1> = {};
    if (name !== undefined) updateFields.name = name;
    if (email) updateFields.email = email.toLowerCase();
    else if (email === "") unsetFields.email = 1;
    if (phone) updateFields.phone = phone;
    else if (phone === "") unsetFields.phone = 1;
    if (company !== undefined) updateFields.company = company;
    if (tags !== undefined) {
      updateFields.tags = tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    }
    if (lifecycleStage !== undefined)
      updateFields.lifecycleStage = lifecycleStage;
    if (leadStatus !== undefined) updateFields.leadStatus = leadStatus;
    if (ownerId !== undefined) {
      updateFields.ownerId = ownerId ? new Types.ObjectId(ownerId) : null;
    }
    if (acquisitionSource !== undefined)
      updateFields.acquisitionSource = acquisitionSource;
    if (preferredChannel !== undefined)
      updateFields.preferredChannel = preferredChannel || null;
    if (nextFollowUpAt !== undefined) {
      updateFields.nextFollowUpAt = nextFollowUpAt
        ? new Date(nextFollowUpAt)
        : null;
    }
    if (lastContactedAt !== undefined) {
      updateFields.lastContactedAt = lastContactedAt
        ? new Date(lastContactedAt)
        : null;
    }

    const updated = await Contact.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        _id: new Types.ObjectId(contactId),
      },
      {
        $set: updateFields,
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
      { new: true, runValidators: true },
    ).populate("ownerId", "name email");
    if (!updated) throw new Error("Contact not found");

    return updated;
  }
}
