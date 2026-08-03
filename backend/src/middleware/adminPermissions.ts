import { NextFunction, Response } from "express";
import { resolveAdminPermissionsById } from "../services/adminService";
import { AdminPermission, permissionsIncludeAll } from "../types/adminRoles";
import { AuthRequest } from "./auth";

export type AdminAuthRequest = AuthRequest & {
  adminPermissions?: AdminPermission[];
};

export function requireAdminPermission(...permissions: AdminPermission[]) {
  return async (req: AdminAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const granted = await resolveAdminPermissionsById(req.adminId);
      if (!permissionsIncludeAll(granted, permissions)) {
        res.status(403).json({ error: "Forbidden — insufficient permissions." });
        return;
      }
      req.adminPermissions = granted;
      next();
    } catch {
      res.status(403).json({ error: "Forbidden — could not resolve admin permissions." });
    }
  };
}
