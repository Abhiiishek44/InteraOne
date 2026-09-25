import { randomUUID } from "crypto";
import { Types } from "mongoose";
import {
  CrmFieldDefinition,
  CrmFieldEntity,
  CrmFieldType,
  ICrmFieldDefinition,
  Contact,
  Account,
  Opportunity,
} from "@shared/models";

type FieldInput = {
  entityType: CrmFieldEntity;
  label: string;
  type: CrmFieldType;
  required?: boolean;
  visible?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  position?: number;
  options?: Array<{ id?: string; label: string }>;
};

type SystemField = {
  key: string;
  label: string;
  type: CrmFieldType;
  required?: boolean;
  protected?: boolean;
  placeholder?: string;
  options?: Array<{ id: string; label: string }>;
};

const SYSTEM_FIELDS: Record<CrmFieldEntity, SystemField[]> = {
  contacts: [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
      protected: true,
      placeholder: "Full name",
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      placeholder: "email@company.com",
    },
    {
      key: "phone",
      label: "Phone",
      type: "text",
      placeholder: "+1 (555) 000-0000",
    },
    { key: "company", label: "Company", type: "single_select" },
    { key: "lifecycleStage", label: "Lifecycle stage", type: "single_select" },
    { key: "leadStatus", label: "Lead status", type: "single_select" },
    { key: "ownerId", label: "Contact owner", type: "single_select" },
    {
      key: "acquisitionSource",
      label: "Acquisition source",
      type: "single_select",
    },
    {
      key: "preferredChannel",
      label: "Preferred channel",
      type: "single_select",
    },
    { key: "nextFollowUpAt", label: "Next follow-up", type: "date" },
    { key: "tags", label: "Tags", type: "multi_select" },
  ],
  accounts: [
    {
      key: "name",
      label: "Company name",
      type: "text",
      required: true,
      protected: true,
    },
    {
      key: "website",
      label: "Website",
      type: "text",
      placeholder: "https://example.com",
    },
    { key: "industry", label: "Industry", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "ownerId", label: "Owner", type: "single_select" },
    { key: "lifecycleStage", label: "Lifecycle", type: "single_select" },
    {
      key: "tags",
      label: "Tags",
      type: "text",
      placeholder: "enterprise, partner",
    },
    { key: "description", label: "Description", type: "text" },
  ],
  opportunities: [
    {
      key: "company",
      label: "Company",
      type: "single_select",
      protected: true,
    },
    {
      key: "primaryContactId",
      label: "Primary contact",
      type: "single_select",
      protected: true,
    },
    {
      key: "title",
      label: "Opportunity name",
      type: "text",
      required: true,
      protected: true,
    },
    { key: "value", label: "Value", type: "number" },
    {
      key: "stage",
      label: "Stage",
      type: "single_select",
      required: true,
      protected: true,
    },
    { key: "ownerId", label: "Owner", type: "single_select" },
    { key: "expectedCloseAt", label: "Expected close", type: "date" },
    {
      key: "nextAction",
      label: "Next action",
      type: "text",
      placeholder: "Schedule product demo",
    },
  ],
  activities: [
    {
      key: "category",
      label: "Activity type",
      type: "single_select",
      required: true,
      protected: true,
    },
    {
      key: "content",
      label: "Summary",
      type: "text",
      required: true,
      protected: true,
      placeholder: "Activity summary",
    },
    {
      key: "dueAt",
      label: "Due date",
      type: "date",
      required: true,
      protected: true,
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
      placeholder: "Add a note or instructions…",
    },
  ],
};

const serialize = (field: ICrmFieldDefinition | any) => ({
  id: String(field._id),
  entityType: field.entityType,
  key: field.key,
  label: field.label,
  type: field.type,
  isSystem: Boolean(field.isSystem),
  protected: Boolean(field.protected),
  required: Boolean(field.required),
  visible: field.visible !== false,
  defaultValue: field.defaultValue ?? null,
  placeholder: field.placeholder || "",
  position: field.position,
  options: [...(field.options || [])]
    .sort((a, b) => a.order - b.order)
    .map((option) => ({ id: option.id, label: option.label })),
});

const optionValues = (field: any) =>
  new Set((field.options || []).map((option: any) => option.id));

export class CrmFieldsService {
  private async fieldHasValues(
    organizationId: string,
    entityType: CrmFieldEntity,
    key: string,
  ) {
    const valueQuery = { $exists: true, $ne: null };
    if (entityType === "contacts")
      return Contact.exists({
        organizationId,
        [`customFields.${key}`]: valueQuery,
      });
    if (entityType === "accounts")
      return Account.exists({
        organizationId,
        [`customFields.${key}`]: valueQuery,
      });
    if (entityType === "opportunities")
      return Opportunity.exists({
        organizationId,
        [`customFields.${key}`]: valueQuery,
      });
    return Opportunity.exists({
      organizationId,
      activities: { $elemMatch: { [`customFields.${key}`]: valueQuery } },
    });
  }

  private async ensureSystemFields(
    organizationId: string,
    entityType: CrmFieldEntity,
  ) {
    const definitions = SYSTEM_FIELDS[entityType];
    const orgId = new Types.ObjectId(organizationId);
    const hasSystemFields = await CrmFieldDefinition.exists({
      organizationId,
      entityType,
      isSystem: true,
    });
    if (!hasSystemFields) {
      await CrmFieldDefinition.updateMany(
        { organizationId, entityType, isSystem: false },
        { $inc: { position: definitions.length } },
      );
    }
    await CrmFieldDefinition.bulkWrite(
      definitions.map((definition, position) => ({
        updateOne: {
          filter: { organizationId, entityType, key: definition.key },
          update: {
            $setOnInsert: {
              key: definition.key,
              label: definition.label,
              type: definition.type,
              placeholder: definition.placeholder || "",
              organizationId: orgId,
              entityType,
              position,
              options: (definition.options || []).map((option, order) => ({
                ...option,
                order,
              })),
            },
            $set: {
              isSystem: true,
              protected: definition.protected || false,
              ...(definition.protected
                ? {
                    required: definition.required || false,
                    visible: true,
                    archivedAt: null,
                  }
                : {}),
            },
          },
          upsert: true,
        },
      })),
    );
  }

  async list(organizationId: string, entityType: CrmFieldEntity) {
    await this.ensureSystemFields(organizationId, entityType);
    const fields = await CrmFieldDefinition.find({
      organizationId,
      entityType,
      archivedAt: null,
    })
      .sort({ position: 1, createdAt: 1 })
      .lean();
    return fields.map(serialize);
  }

  async create(organizationId: string, userId: string, input: FieldInput) {
    const count = await CrmFieldDefinition.countDocuments({
      organizationId,
      entityType: input.entityType,
      archivedAt: null,
    });
    if (count >= 100)
      throw new Error("A CRM entity can have up to 100 custom fields");

    const baseKey =
      input.label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48) || "field";
    let key = `custom_${baseKey}`;
    let suffix = 2;
    while (
      await CrmFieldDefinition.exists({
        organizationId,
        entityType: input.entityType,
        key,
      })
    ) {
      key = `custom_${baseKey.slice(0, 37)}_${suffix++}`;
    }

    const supportsOptions = ["single_select", "multi_select"].includes(
      input.type,
    );
    const options = supportsOptions
      ? (input.options || []).map((option, order) => ({
          id: option.id || randomUUID(),
          label: option.label,
          order,
        }))
      : [];
    let defaultValue = input.defaultValue ?? null;
    if (input.type === "single_select" && typeof defaultValue === "string") {
      const requestedDefault = defaultValue;
      defaultValue =
        options.find(
          (option) =>
            option.id === requestedDefault ||
            option.label.toLowerCase() === requestedDefault.toLowerCase(),
        )?.id || null;
    }
    if (input.type === "multi_select" && typeof defaultValue === "string") {
      const requested = defaultValue
        .split(",")
        .map((item) => item.trim().toLowerCase());
      defaultValue = options
        .filter(
          (option) =>
            requested.includes(option.id.toLowerCase()) ||
            requested.includes(option.label.toLowerCase()),
        )
        .map((option) => option.id);
    }
    const field = await CrmFieldDefinition.create({
      organizationId,
      createdBy: userId,
      entityType: input.entityType,
      key,
      label: input.label,
      type: input.type,
      required: input.required || false,
      visible: input.visible !== false,
      defaultValue,
      placeholder: input.placeholder || "",
      position: input.position ?? count,
      options,
    });
    return serialize(field);
  }

  async update(
    organizationId: string,
    fieldId: string,
    input: Partial<Omit<FieldInput, "entityType">>,
  ) {
    const field = await CrmFieldDefinition.findOne({
      _id: fieldId,
      organizationId,
      archivedAt: null,
    });
    if (!field) throw new Error("CRM field not found");
    if (input.label !== undefined) field.label = input.label;
    if (input.type !== undefined && input.type !== field.type) {
      if (field.isSystem)
        throw new Error("System field types cannot be changed");
      if (
        await this.fieldHasValues(organizationId, field.entityType, field.key)
      ) {
        throw new Error(
          "Field type cannot be changed after values have been saved",
        );
      }
      field.type = input.type;
      field.options = [];
    }
    if (input.required !== undefined) {
      if (field.protected && !input.required)
        throw new Error("Protected fields must remain required");
      field.required = input.required;
    }
    if (input.visible !== undefined) {
      if (field.protected && !input.visible)
        throw new Error("Protected fields cannot be hidden");
      if (
        !input.visible &&
        (input.required ?? field.required) &&
        (input.defaultValue ?? field.defaultValue) == null
      )
        throw new Error(
          "A required field needs a default value before it can be hidden",
        );
      field.visible = input.visible;
    }
    if (input.defaultValue !== undefined)
      field.defaultValue = input.defaultValue;
    if (input.placeholder !== undefined) field.placeholder = input.placeholder;
    if (input.options !== undefined) {
      if (!["single_select", "multi_select"].includes(field.type)) {
        throw new Error("Only select fields can have options");
      }
      field.options = input.options.map((option, order) => ({
        id: option.id || randomUUID(),
        label: option.label,
        order,
      }));
    }
    await field.save();
    return serialize(field);
  }

  async archive(organizationId: string, fieldId: string) {
    const existing = await CrmFieldDefinition.findOne({
      _id: fieldId,
      organizationId,
      archivedAt: null,
    });
    if (!existing) throw new Error("CRM field not found");
    if (existing.protected)
      throw new Error("Protected system fields cannot be removed");
    const field = existing.isSystem
      ? await CrmFieldDefinition.findByIdAndUpdate(
          fieldId,
          { $set: { visible: false } },
          { new: true },
        )
      : await CrmFieldDefinition.findByIdAndUpdate(
          fieldId,
          { $set: { archivedAt: new Date() } },
          { new: true },
        );
    if (!field) throw new Error("CRM field not found");
  }

  async reorder(
    organizationId: string,
    entityType: CrmFieldEntity,
    fieldIds: string[],
  ) {
    const fields = await CrmFieldDefinition.find({
      organizationId,
      entityType,
      archivedAt: null,
    }).select("_id");
    const existing = new Set(fields.map((field) => String(field._id)));
    if (
      fieldIds.length !== existing.size ||
      fieldIds.some((id) => !existing.has(id))
    ) {
      throw new Error("Reorder must include every active field exactly once");
    }
    await CrmFieldDefinition.bulkWrite(
      fieldIds.map((id, position) => ({
        updateOne: {
          filter: { _id: id, organizationId },
          update: { $set: { position } },
        },
      })),
    );
    return this.list(organizationId, entityType);
  }

  async validateValues(
    organizationId: string,
    entityType: CrmFieldEntity,
    values: Record<string, unknown> | undefined,
    requireAll = false,
  ) {
    const fields = await CrmFieldDefinition.find({
      organizationId,
      entityType,
      archivedAt: null,
      isSystem: false,
    }).lean();
    const byKey = new Map(fields.map((field) => [field.key, field]));
    const normalized: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        normalized[field.key] = field.defaultValue;
      }
    }

    for (const [key, value] of Object.entries(values || {})) {
      const field = byKey.get(key);
      if (!field) throw new Error(`Unknown or archived CRM field: ${key}`);
      if (
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        normalized[key] = null;
        continue;
      }
      const validOptions = optionValues(field);
      if (field.type === "text" && typeof value !== "string")
        throw new Error(`${field.label} must be text`);
      if (
        field.type === "number" &&
        (typeof value !== "number" || !Number.isFinite(value))
      )
        throw new Error(`${field.label} must be a number`);
      if (field.type === "boolean" && typeof value !== "boolean")
        throw new Error(`${field.label} must be true or false`);
      if (
        field.type === "date" &&
        (typeof value !== "string" || Number.isNaN(Date.parse(value)))
      )
        throw new Error(`${field.label} must be a valid date`);
      if (
        field.type === "single_select" &&
        (typeof value !== "string" || !validOptions.has(value))
      )
        throw new Error(`${field.label} has an invalid option`);
      if (
        field.type === "multi_select" &&
        (!Array.isArray(value) ||
          value.some(
            (item) => typeof item !== "string" || !validOptions.has(item),
          ))
      )
        throw new Error(`${field.label} has an invalid option`);
      if (
        ["file", "image", "signature"].includes(field.type) &&
        (typeof value !== "object" ||
          Array.isArray(value) ||
          typeof (value as Record<string, unknown>).fileKey !== "string" ||
          typeof (value as Record<string, unknown>).fileName !== "string")
      )
        throw new Error(`${field.label} must contain a valid uploaded file`);
      normalized[key] = typeof value === "string" ? value.trim() : value;
    }

    if (requireAll) {
      const missing = fields.find(
        (field) =>
          field.required &&
          (normalized[field.key] === undefined ||
            normalized[field.key] === null),
      );
      if (missing) throw new Error(`${missing.label} is required`);
    }
    return normalized;
  }
}
