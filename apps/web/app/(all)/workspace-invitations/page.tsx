/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Boxes, Share2, Star, User2 } from "lucide-react";
import { CheckIcon, CloseIcon } from "@plane/propel/icons";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EmptySpace, EmptySpaceItem } from "@/components/ui/empty-space";
// constants
import { WORKSPACE_INVITATION } from "@plane/constants";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceService } from "@/services/workspace.service";
// services

// service initialization
const workspaceService = new WorkspaceService();

function WorkspaceInvitationPage() {
  // router
  const router = useAppRouter();
  // query params
  const searchParams = useSearchParams();
  const invitation_id = searchParams.get("invitation_id");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  // El correo de invitacion trae invitation_id, email y slug (ver
  // workspace_invitation_task.py). El backend EXIGE el email en el cuerpo y
  // compara que coincida con el de la invitacion; sin el responde 403.
  const email = searchParams.get("email");
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();

  const { data: invitationDetail, error } = useSWR(
    invitation_id && slug && WORKSPACE_INVITATION(invitation_id.toString()),
    invitation_id && slug
      ? () => workspaceService.getWorkspaceInvitation(slug.toString(), invitation_id.toString())
      : null
  );

  const handleAccept = () => {
    if (!invitationDetail) return;
    setFallo(null);
    setEnviando(true);
    workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: true,
        token: token,
        // Sin esto el servidor responde 403 y la pantalla se queda como estaba,
        // que es exactamente lo que le pasaba al equipo al pulsar Aceptar.
        email: email ?? invitationDetail.email,
      })
      .then(() => {
        if (invitationDetail.email === currentUser?.email) {
          router.push(`/${invitationDetail.workspace.slug}`);
        } else {
          router.push("/");
        }
      })
      .catch((err: unknown) => {
        // Y aqui estaba la otra mitad del problema: el error se escribia en la
        // consola y el usuario no veia nada. Un fallo invisible parece una
        // pantalla congelada.
        console.error(err);
        setEnviando(false);
        setFallo(
          "No hemos podido aceptar la invitación. Comprueba que has entrado con el mismo " +
            "correo al que te invitamos, o avisanos y te mandamos otra."
        );
      });
  };

  const handleReject = () => {
    if (!invitationDetail) return;
    setFallo(null);
    void workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: false,
        token: token,
        email: email ?? invitationDetail.email,
      })
      .then(() => {
        router.push("/");
      })
      .catch((err: unknown) => {
        console.error(err);
        setFallo("No hemos podido registrar tu respuesta. Vuelve a intentarlo en un momento.");
      });
  };

  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        {invitationDetail && !invitationDetail.responded_at ? (
          error ? (
            <div className="shadow-2xl flex w-full flex-col space-y-4 rounded-sm border border-subtle bg-surface-1 px-4 py-8 text-center md:w-1/3">
              <h2 className="text-18 uppercase">INVITATION NOT FOUND</h2>
            </div>
          ) : (
            <EmptySpace
              title={`Te damos la bienvenida a ${invitationDetail.workspace.name}`}
              description="Aquí es donde vive el trabajo del equipo: las tareas de cada cliente, con su tiempo y su estado. Acepta la invitación para entrar."
            >
              <EmptySpaceItem
                Icon={CheckIcon}
                title={enviando ? "Entrando…" : "Aceptar la invitación"}
                action={enviando ? undefined : handleAccept}
              />
              <EmptySpaceItem Icon={CloseIcon} title="Ignorar" action={enviando ? undefined : handleReject} />
              {fallo && <p className="mt-4 text-13 text-danger-primary">{fallo}</p>}
            </EmptySpace>
          )
        ) : error || invitationDetail?.responded_at ? (
          invitationDetail?.accepted ? (
            <EmptySpace
              title={`Ya formas parte de ${invitationDetail.workspace.name}`}
              description="Aquí es donde vive el trabajo del equipo: las tareas de cada cliente, con su tiempo y su estado."
            >
              <EmptySpaceItem Icon={Boxes} title="Ir al inicio" href="/" />
            </EmptySpace>
          ) : (
            <EmptySpace
              title="Este enlace de invitación ya no está activo."
              description="Puede que ya lo hayas aceptado antes. Entra con tu cuenta y, si no ves el espacio, dínoslo y te mandamos otra invitación."
            >
              {!currentUser ? (
                <EmptySpaceItem Icon={User2} title="Entra para continuar" href="/" />
              ) : (
                <EmptySpaceItem Icon={Boxes} title="Ir al inicio" href="/" />
              )}
              <EmptySpaceItem Icon={Star} title="Danos una estrella en GitHub" href="https://github.com/makeplane" />
              <EmptySpaceItem
                Icon={Share2}
                title="Únete a nuestra comunidad"
                href="https://forum.plane.so"
              />
            </EmptySpace>
          )
        ) : !invitation_id || !slug ? (
          // Sin parametros no hay nada que consultar: antes se quedaba girando
          // para siempre, que es la peor forma de decir "este enlace no vale".
          <EmptySpace
            title="Este enlace de invitacion no es valido"
            description="Abre el enlace tal y como viene en el correo, sin recortarlo. Si no te funciona, dinos y te mandamos otra invitacion."
          >
            <EmptySpaceItem Icon={Boxes} title="Ir al inicio" href="/" />
          </EmptySpace>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <LogoSpinner />
          </div>
        )}
      </div>
    </AuthenticationWrapper>
  );
}

export default observer(WorkspaceInvitationPage);
