import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { CATEGORIES } from '../config.js';
import { Thread, Reply } from '../models.js';
import { requireUser } from '../auth.js';

const router = Router();

const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

const author = (u) => ({ id: u?._id?.toString() ?? null, name: u?.name ?? 'Former member' });
const threadJson = (t) => ({
  id: t.id,
  title: t.title,
  body: t.body,
  category: t.category,
  author: author(t.author),
  replyCount: t.replyCount,
  createdAt: t.createdAt,
});
const replyJson = (r) => ({ id: r.id, body: r.body, author: author(r.author), createdAt: r.createdAt });

function text(value, min, max, label) {
  if (typeof value !== 'string') return { error: `${label} is required.` };
  const v = value.trim();
  if (v.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (v.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value: v };
}

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
  next();
}

const canModify = (user, doc) => user.role === 'admin' || doc.author.toString() === user.id;

router.get('/threads', async (req, res) => {
  const filter = {};
  if (typeof req.query.category === 'string' && CATEGORIES.includes(req.query.category)) {
    filter.category = req.query.category;
  }
  const threads = await Thread.find(filter).sort({ createdAt: -1 }).limit(100).populate('author', 'name');
  res.json({ threads: threads.map(threadJson) });
});

router.get('/threads/:id', validId, async (req, res) => {
  const thread = await Thread.findById(req.params.id).populate('author', 'name');
  if (!thread) return res.status(404).json({ error: 'That question no longer exists.' });
  const replies = await Reply.find({ thread: thread._id }).sort({ createdAt: 1 }).limit(500).populate('author', 'name');
  res.json({ thread: threadJson(thread), replies: replies.map(replyJson) });
});

router.post('/threads', writeLimiter, requireUser, async (req, res) => {
  const title = text(req.body?.title, 8, 140, 'Question');
  const body = text(req.body?.body, 10, 3000, 'Details');
  if (title.error || body.error) return res.status(400).json({ error: title.error || body.error });
  const category = req.body?.category;
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Pick a topic from the list.' });

  const thread = await Thread.create({ title: title.value, body: body.value, category, author: req.user._id });
  await thread.populate('author', 'name');
  res.status(201).json({ thread: threadJson(thread) });
});

router.post('/threads/:id/replies', writeLimiter, requireUser, validId, async (req, res) => {
  const body = text(req.body?.body, 3, 2000, 'Reply');
  if (body.error) return res.status(400).json({ error: body.error });

  const thread = await Thread.findById(req.params.id);
  if (!thread) return res.status(404).json({ error: 'That question no longer exists.' });

  const reply = await Reply.create({ thread: thread._id, body: body.value, author: req.user._id });
  await Thread.updateOne({ _id: thread._id }, { $inc: { replyCount: 1 } });
  await reply.populate('author', 'name');
  res.status(201).json({ reply: replyJson(reply) });
});

router.delete('/threads/:id', writeLimiter, requireUser, validId, async (req, res) => {
  const thread = await Thread.findById(req.params.id);
  if (!thread) return res.json({ ok: true });
  if (!canModify(req.user, thread)) return res.status(403).json({ error: 'You can only delete your own posts.' });
  await Reply.deleteMany({ thread: thread._id });
  await thread.deleteOne();
  res.json({ ok: true });
});

router.delete('/replies/:id', writeLimiter, requireUser, validId, async (req, res) => {
  const reply = await Reply.findById(req.params.id);
  if (!reply) return res.json({ ok: true });
  if (!canModify(req.user, reply)) return res.status(403).json({ error: 'You can only delete your own posts.' });
  await reply.deleteOne();
  await Thread.updateOne({ _id: reply.thread, replyCount: { $gt: 0 } }, { $inc: { replyCount: -1 } });
  res.json({ ok: true });
});

export default router;
