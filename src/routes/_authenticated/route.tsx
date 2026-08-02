import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() lê a sessão local (sem rede) — em redes instáveis getUser()
    // falharia e expulsava o utilizador com sessão válida.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user };
  },

  component: () => <Outlet />,
});
