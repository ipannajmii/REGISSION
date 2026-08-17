"use client";

import { useState } from "react";
import emailjs from "@emailjs/browser";
import PageShell from "@/components/page-shell";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("Please fill in all fields.");
      return;
    }

    setSending(true);

    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        {
          from_name: name,
          from_email: email,
          message: message,
          to_email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );

      setStatus("Message sent successfully ✅");
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setStatus("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell>
      <section className="w-full px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-5xl font-black text-white">Contact</h1>
          <p className="mt-4 text-lg text-white/70">
            Get in touch for project demos, technical discussions, or collaborations related to Regission.
          </p>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
            <form
              onSubmit={sendMessage}
              className="rounded-3xl border border-white/10 bg-[#0b1325]/70 p-6 backdrop-blur"
            >
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none placeholder:text-white/40"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="mt-5 w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none placeholder:text-white/40"
                placeholder="Your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <textarea
                className="mt-5 h-56 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white outline-none placeholder:text-white/40"
                placeholder="Your message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              {status && (
                <p className="mt-4 text-sm text-white/80">{status}</p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="mt-6 rounded-2xl bg-white px-7 py-4 font-bold text-black transition hover:brightness-90 disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </form>

            <div className="rounded-3xl border border-white/10 bg-[#0b1325]/70 p-6 backdrop-blur">
              <h2 className="text-2xl font-black text-white">
                Project Contact
              </h2>

              <div className="mt-8 space-y-7 text-white/75">
                <div>
                  <p className="text-sm font-bold text-white/50">Email</p>
                  <p className="mt-2 text-lg">regissionofficial@gmail.com</p>
                </div>

                <div>
                  <p className="text-sm font-bold text-white/50">Location</p>
                  <p className="mt-2 text-lg">UiTM / Local Demo Setup</p>
                </div>

                <div>
                  <p className="text-sm font-bold text-white/50">Focus</p>
                  <p className="mt-2 text-lg">
                    Vision-based chess notation and live publishing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}