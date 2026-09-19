import { Navigate, Route, Routes, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { Shell, type Me } from "@web/components/shell";
import Login from "@web/pages/Login";
import Verify from "@web/pages/Verify";
import Overview from "@web/pages/Overview";
import UsagePage from "@web/pages/Usage";
import ApiKeys from "@web/pages/ApiKeys";
import AiConfig from "@web/pages/AiConfig";
import ChatPage from "@web/pages/Chat";
import SharedChatPage from "@web/pages/SharedChat";
import LeaderboardPage from "@web/pages/LeaderboardPage";
import McpSkillsPage from "@web/pages/McpSkillsPage";
import Help from "@web/pages/Help";
import AdminUsers from "@web/pages/AdminUsers";
import AdminConnections from "@web/pages/AdminConnections";
import AdminModels from "@web/pages/AdminModels";
import AdminQuotas from "@web/pages/AdminQuotas";
import AdminFeedbacks from "@web/pages/AdminFeedbacks";
import AdminAnalytics from "@web/pages/AdminAnalytics";
import AdminLogs from "@web/pages/AdminLogs";
import AdminAnnouncements from "@web/pages/AdminAnnouncements";
import AdminSettings from "@web/pages/AdminSettings";
import ServerStatusPage from "@web/pages/ServerStatusPage";
import ChangelogPage from "@web/pages/ChangelogPage";
import ModelsDataPage from "@web/pages/ModelsDataPage";
import ModelDetailPage from "@web/pages/ModelDetailPage";
import IssuePage from "@web/pages/IssuePage";
import AdminIssues from "@web/pages/AdminIssues";

export function useMe() {
	return useQuery({
		queryKey: ["me"],
		queryFn: () => api<{ user: Me }>("/api/auth/me"),
		retry: false,
	});
}

function ShellRoute() {
	const { data, isLoading } = useMe();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center bg-paper">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-2">LOADING...</div>
			</div>
		);
	}

	// For guest on /issues or /issue, provide fallback guest object so sidebar renders cleanly
	const isIssuePath = location.pathname === "/issues" || location.pathname === "/issue";
	if (!data?.user) {
		if (isIssuePath) {
			const guestMe: Me = {
				id: "guest",
				email: "guest@mnrouter",
				role: "user",
				displayName: "Guest User",
				packageName: "Guest",
				monthlyTokenBudget: null,
			};
			return <Shell me={guestMe} />;
		}
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	return <Shell me={data.user} />;
}

export default function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/auth/verify" element={<Verify />} />
			<Route path="/invite/accept" element={<Verify />} />
			<Route path="/share/:token" element={<SharedChatPage />} />
			<Route path="/" element={<ShellRoute />}>
				<Route index element={<Overview />} />
				<Route path="usage" element={<UsagePage />} />
				<Route path="leaderboard" element={<LeaderboardPage />} />
				<Route path="keys" element={<ApiKeys />} />
				<Route path="config" element={<AiConfig />} />
				<Route path="chat" element={<ChatPage />} />
				<Route path="mcp" element={<McpSkillsPage />} />
				<Route path="data" element={<ModelsDataPage />} />
				<Route path="data/:provider/:modelId" element={<ModelDetailPage />} />
				<Route path="status" element={<ServerStatusPage />} />
				<Route path="changelog" element={<ChangelogPage />} />
				<Route path="issues" element={<IssuePage />} />
				<Route path="issue" element={<Navigate to="/issues" replace />} />
				<Route path="admin/users" element={<AdminUsers />} />
				<Route path="admin/connections" element={<AdminConnections />} />
				<Route path="admin/models" element={<AdminModels />} />
				<Route path="admin/quotas" element={<AdminQuotas />} />
				<Route path="admin/analytics" element={<AdminAnalytics />} />
				<Route path="admin/feedbacks" element={<AdminFeedbacks />} />
				<Route path="admin/logs" element={<AdminLogs />} />
				<Route path="admin/settings" element={<AdminSettings />} />
				<Route path="admin/announcements" element={<AdminAnnouncements />} />
				<Route path="admin/issues" element={<AdminIssues />} />
			</Route>
		</Routes>
	);
}
