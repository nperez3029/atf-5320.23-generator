{
  description = "NFA Form processor with mupdf.js";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        nodeModules = pkgs.importNpmLock.buildNodeModules {
          npmRoot = self;
          inherit (pkgs) nodejs;
        };

        buildPackage = pkgs.stdenv.mkDerivation {
          pname = "atf-5320-23-generator";
          version = "1.0.0";

          src = self;

          nativeBuildInputs = with pkgs; [
            nodejs
            nodePackages.npm
          ];

          buildPhase = ''
            ln -s ${nodeModules}/node_modules node_modules
            npm run build
          '';

          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';
        };

      in
      {
        packages = {
          default = buildPackage;
          nix-direnv = pkgs.nix-direnv;
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.importNpmLock.hooks.linkNodeModulesHook
            pkgs.nodejs
            pkgs.act
          ];

          npmDeps = nodeModules;
        };
      }
    );
}
