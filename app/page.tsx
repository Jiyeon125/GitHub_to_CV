"use client";

import { FormEvent, useState } from "react";

type RepoResult = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
  score: number;
  scoreBreakdown: {
    nonFork: number;
    description: number;
    language: number;
    stars: number;
    forks: number;
    recency: number;
  };
  hasReadme: boolean;
};

type AnalyzePayload = {
  username: string;
  profileUrl: string;
  publicRepos: number;
  selectedRepos: RepoResult[];
  topLanguage: string;
  summary: string;
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePayload | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed.");
      }

      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>GitHub Developer Activity Report (PoC)</h1>
      <p className="muted">Enter a GitHub username to run the first validation-stage analysis.</p>

      <form onSubmit={onSubmit} className="form">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. torvalds"
          aria-label="GitHub username"
        />
        <button type="submit" disabled={loading || !username.trim()}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>

      {loading && <p className="state">Loading GitHub data...</p>}
      {error && <p className="state error">{error}</p>}

      {result && (
        <section className="results">
          <p>{result.summary}</p>
          <p><strong>Top language:</strong> {result.topLanguage}</p>
          <p>
            Profile: <a href={result.profileUrl} target="_blank" rel="noreferrer">{result.profileUrl}</a>
          </p>

          {result.selectedRepos.length === 0 ? (
            <p className="state">No representative repositories available.</p>
          ) : (
            <div className="cards">
              {result.selectedRepos.map((repo) => (
                <article key={repo.id} className="card">
                  <h2>
                    <a href={repo.html_url} target="_blank" rel="noreferrer">{repo.name}</a>
                  </h2>
                  <p>{repo.description || "No description"}</p>
                  <ul>
                    <li>Score: {repo.score}</li>
                    <li>Language: {repo.language ?? "Unknown"}</li>
                    <li>Stars: {repo.stargazers_count}</li>
                    <li>Forks: {repo.forks_count}</li>
                    <li>README: {repo.hasReadme ? "Yes" : "No"}</li>
                    <li>Updated: {new Date(repo.updated_at).toLocaleDateString()}</li>
                  </ul>
                  <details>
                    <summary>Score breakdown</summary>
                    <ul>
                      <li>Non-fork bonus: +{repo.scoreBreakdown.nonFork}</li>
                      <li>Description bonus: +{repo.scoreBreakdown.description}</li>
                      <li>Language bonus: +{repo.scoreBreakdown.language}</li>
                      <li>Stars bonus: +{repo.scoreBreakdown.stars}</li>
                      <li>Forks bonus: +{repo.scoreBreakdown.forks}</li>
                      <li>Recency bonus: +{repo.scoreBreakdown.recency}</li>
                    </ul>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
