import { Navigate, Route, Routes, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { Shell, type Me } from "@web/components/shell";
import Login from "@web/pages/Login";
import Verify from "@web/pages/Verify";
import Overview from "@web/pages/Overview";
import UsagePage from "@web/pages/Usage";
import ApiKeys from "@web/pages/ApiKeys";
import AdminUsers from "@web/pages/AdminUsers";
import AdminConnections from "@web/pages/AdminConnections";
import AdminModels from "@web/pages/AdminModels";
import AdminLogs from "@web/pages/AdminLogs";
import AdminSettings from "@web/pages/AdminSettings";

export function useMe() {
	return useQuery({
		queryKey: ["me"],
		queryFn: () => api<{ user: Me }>("/api/auth/me"),
		retry: false,
	});
}

function Protected({ children }: { children: (me: Me) => React.ReactNode }) {
	const { data, isLoading, isError } = useMe();
	const location = useLocation();
	if (isLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center bg-paper">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-2">loading…</div>
			</div>
		);
	}
	if (isError || !data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	return <>{children(data.user)}</>;
}

export default function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/auth/verify" element={<Verify />} />
			<Route
				path="/"
				element={
					<Protected>
						{(me) => <Shell me={me} />}
					</Protected>
				}
			>
				<Route index element={<Overview />} />
				<Route path="usage" element={<UsagePage />} />
				<Route path="keys" element={<ApiKeys />} />
				<Route path="admin/users" element={<AdminUsers />} />
				<Route path="admin/connections" element={<AdminConnections />} />
				<Route path="admin/models" element={<AdminModels />} />
				<Route path="admin/logs" element={<AdminLogs />} />
				<Route path="admin/settings" element={<AdminSettings />} />
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}
