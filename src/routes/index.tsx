import { createFileRoute } from "@tanstack/react-router";
import { Barnboard } from "@/components/barnboard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Barnboard />;
}
