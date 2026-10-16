import { describe, expect, it } from "vitest";
import { checkSuperAdminRemoval, rolesAllow, visibleCenterIds, type RoleGrant } from "@/lib/permissions";

const superAdmin: RoleGrant[] = [{ role: "super_admin", centerId: null }];
const admin: RoleGrant[] = [{ role: "admin", centerId: null }];
const manager: RoleGrant[] = [{ role: "center_manager", centerId: "c1" }];
const none: RoleGrant[] = [];

describe("rolesAllow", () => {
  it("super_admin can do everything", () => {
    expect(rolesAllow(superAdmin, "admin.manage")).toBe(true);
    expect(rolesAllow(superAdmin, "audit.read")).toBe(true);
    expect(rolesAllow(superAdmin, "center.delete", { centerId: "x" })).toBe(true);
  });

  it("admin cannot manage admins or read audit", () => {
    expect(rolesAllow(admin, "admin.manage")).toBe(false);
    expect(rolesAllow(admin, "audit.read")).toBe(false);
    expect(rolesAllow(admin, "center.create")).toBe(true);
    expect(rolesAllow(admin, "period.confirm", { centerId: "x" })).toBe(true);
    expect(rolesAllow(admin, "job.run")).toBe(true);
  });

  it("center_manager is limited to own center", () => {
    expect(rolesAllow(manager, "admin.access")).toBe(true);
    expect(rolesAllow(manager, "period.confirm", { centerId: "c1" })).toBe(true);
    expect(rolesAllow(manager, "period.confirm", { centerId: "c2" })).toBe(false);
    expect(rolesAllow(manager, "period.confirm")).toBe(false);
    expect(rolesAllow(manager, "center.update", { centerId: "c1" })).toBe(true);
    expect(rolesAllow(manager, "center.delete", { centerId: "c1" })).toBe(false);
    expect(rolesAllow(manager, "center.create")).toBe(false);
    expect(rolesAllow(manager, "admin.manage")).toBe(false);
    expect(rolesAllow(manager, "job.run")).toBe(false);
  });

  it("users without roles cannot do admin actions", () => {
    expect(rolesAllow(none, "admin.access")).toBe(false);
  });

  it("visible centers", () => {
    expect(visibleCenterIds(admin)).toBeNull();
    expect(visibleCenterIds(manager)).toEqual(["c1"]);
  });
});

describe("super_admin removal safety", () => {
  it("blocks removing yourself", () => {
    expect(checkSuperAdminRemoval({ actorId: "a", targetUserId: "a", superAdminCount: 3 }).ok).toBe(false);
  });
  it("blocks removing the last super_admin", () => {
    expect(checkSuperAdminRemoval({ actorId: "a", targetUserId: "b", superAdminCount: 1 }).ok).toBe(false);
  });
  it("allows removing another when more remain", () => {
    expect(checkSuperAdminRemoval({ actorId: "a", targetUserId: "b", superAdminCount: 2 }).ok).toBe(true);
  });
});
