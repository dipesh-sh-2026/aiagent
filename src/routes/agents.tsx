import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/agents")({
    head: () => ({
        meta: [
            { title: "Agents — Nexus AI" },
            { name: "description", content: "AI Agents information" },
        ],
    }),
    component: AgentsPage,
})

function AgentsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <div className="prose max-w-none">
                        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                            <h2 className="mt-0 text-blue-900 font-semibold">⚠️ Important</h2>
                            <p className="text-blue-800 mb-2">
                                This project is connected to <a href="https://aiagent.dev" className="text-blue-600 underline">Lovable</a>.
                                Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits
                                that are already pushed — as it rewrites history on Lovable's side and the user will likely lose
                                their project history.
                            </p>
                            <p className="text-blue-800 m-0">
                                Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep
                                the branch in a working state.
                            </p>
                        </div>

                        <div className="mt-8 text-center text-slate-600">
                            <h1 className="text-3xl font-bold text-slate-900 mb-4">AI Agent Project</h1>
                            <p>Connected to Lovable • TanStack Start • React</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
