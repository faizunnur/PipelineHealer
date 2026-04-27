"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export function WebhookSecretCopy({ secret }: { secret: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            toast({
                title: "Secret copied",
                description: "The webhook secret has been copied to your clipboard.",
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast({
                title: "Failed to copy",
                description: "Please try again or copy manually.",
                variant: "destructive",
            });
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="ml-2 text-primary hover:underline text-xs inline-flex items-center gap-1"
        >
            {copied ? (
                <>
                    <Check className="w-3 h-3" />
                    Copied
                </>
            ) : (
                <>
                    <Copy className="w-3 h-3" />
                    Copy full secret
                </>
            )}
        </button>
    );
}
