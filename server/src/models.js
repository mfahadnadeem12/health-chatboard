import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Only what the board needs: Google's stable id and a display name. No email is stored.
const userSchema = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 60 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

const threadSchema = new Schema(
  {
    title: { type: String, required: true, minlength: 8, maxlength: 140 },
    body: { type: String, required: true, minlength: 10, maxlength: 3000 },
    category: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
threadSchema.index({ createdAt: -1 });
threadSchema.index({ category: 1, createdAt: -1 });

const replySchema = new Schema(
  {
    thread: { type: Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
    body: { type: String, required: true, minlength: 3, maxlength: 2000 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);
export const Thread = model('Thread', threadSchema);
export const Reply = model('Reply', replySchema);
