import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFacebookOAuthState extends Document {
  _id: Types.ObjectId;
  stateHash: string;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  redirectUri: string;
  expiresAt: Date;
  createdAt: Date;
}

const facebookOAuthStateSchema = new Schema<IFacebookOAuthState>(
  {
    stateHash: { type: String, required: true, unique: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

facebookOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FacebookOAuthState = mongoose.model<IFacebookOAuthState>(
  "FacebookOAuthState",
  facebookOAuthStateSchema,
);
