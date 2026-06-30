import goodPadelLogo from "@/assets/new-padel-id-logo.jpg";

export interface TenantConfig {
  id: string;
  name: string;
  subtext: string;
  logo: string;
  platformName: string;
  instagram?: string;
}

export const activeTenant: TenantConfig = {
  id: "good-padel",
  name: "Good Padel",
  subtext: "Anita Quiroga",
  logo: goodPadelLogo,
  platformName: "Padel ID",
  instagram: "@goodsports.jb",
};
