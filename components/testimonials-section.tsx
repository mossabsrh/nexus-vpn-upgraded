"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import { AuthDialog } from "./auth-dialog"
import { Textarea } from "./ui/textarea"
import { useAuth } from "./auth-provider"
import { apiFetch } from "@/lib/api"

type Testimonial = {
  id: number
  name: string
  content: string
  createdAt: string
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function TestimonialsSection() {
  const { isAuthenticated } = useAuth()
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    apiFetch("/testimonials")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load comments.")
        const data = await response.json()
        setTestimonials(data.testimonials)
      })
      .catch(() => setErrorMessage("Comments are temporarily unavailable."))
      .finally(() => setIsLoading(false))
  }, [])

  const submitComment = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const response = await apiFetch("/testimonials", {
        method: "POST",
        skipCsrf: true,
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? "Please enter a comment between 10 and 1,000 characters.")
      }

      setTestimonials((current) => [data.testimonial, ...current])
      setContent("")
      setSuccessMessage("Your comment is now visible.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish your comment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/3 to-transparent pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">Community</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            From <span className="text-gradient">real accounts</span>
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Comments are written by NexusVPN account holders and tied to their accounts.
          </p>
        </motion.div>

        {isAuthenticated ? (
          <div className="mb-10 w-full rounded-2xl border border-border bg-muted/30 p-5">
            <label htmlFor="testimonial-content" className="mb-2 block text-sm font-medium text-foreground">
              Share your experience
            </label>
            <Textarea
              id="testimonial-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What has NexusVPN helped you do?"
              maxLength={1000}
              className="mb-3 min-h-24 resize-y bg-background"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{content.length}/1000</span>
              <button
                type="button"
                onClick={submitComment}
                disabled={isSubmitting || content.trim().length < 10}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSubmitting ? "Publishing..." : "Publish comment"}
              </button>
            </div>
            {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
            {successMessage && <p className="mt-3 text-sm text-emerald-600">{successMessage}</p>}
          </div>
        ) : (
          <div className="mb-10 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5">
            <p className="text-sm text-muted-foreground">Have an account? Share your experience with the community.</p>
            <AuthDialog triggerText="Sign in to comment" triggerClassName="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" />
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : testimonials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No comments yet. Be the first account holder to share your experience.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.article
                key={testimonial.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card flex h-full flex-col rounded-2xl p-6 transition-all duration-400 hover:glow-cyan"
              >
                <p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">“{testimonial.content}”</p>
                <div className="flex items-center gap-3 border-t border-border/50 pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-foreground">
                    {initials(testimonial.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">Verified account holder</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
