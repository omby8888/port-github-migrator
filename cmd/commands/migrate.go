package commands

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/omby8888/port-github-migrator/internal/migrator"
	"github.com/omby8888/port-github-migrator/internal/models"
	"github.com/omby8888/port-github-migrator/internal/port"
)

func NewMigrateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "migrate <blueprint>",
		Short:        "Migrate entities from a specific blueprint or all blueprints",
		Long:         `Migrate entities ownership from the old GitHub App integration to the new GitHub Ocean integration.`,
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("❌ blueprint argument is required. Usage: migrate <blueprint|all>")
			}
			return nil
		},
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			portURL, _ := cmd.Flags().GetString("port-url")
			clientID, _ := cmd.Flags().GetString("client-id")
			clientSecret, _ := cmd.Flags().GetString("client-secret")
			oldInstallID, _ := cmd.Flags().GetString("old-installation-id")
			newInstallID, _ := cmd.Flags().GetString("new-installation-id")
			dryRun, _ := cmd.Flags().GetBool("dry-run")

			blueprint := args[0]

			// Validate required parameters
			var missing []string
			if clientID == "" {
				missing = append(missing, "--client-id")
			}
			if clientSecret == "" {
				missing = append(missing, "--client-secret")
			}
			if oldInstallID == "" {
				missing = append(missing, "--old-installation-id")
			}
			if newInstallID == "" {
				missing = append(missing, "--new-installation-id")
			}
			if len(missing) > 0 {
				return fmt.Errorf("❌ missing required options: %v", missing)
			}

			// Create Port client
			client := port.NewClient(portURL, clientID, clientSecret)

			// Get integration version
			version, err := client.GetIntegrationVersion(newInstallID)
			if err != nil {
				return fmt.Errorf("failed to get integration version: %w", err)
			}

			// Construct new datasource ID
			newDatasourceID := fmt.Sprintf("port-ocean/github-ocean/%s/%s/exporter", version, newInstallID)

			// Create config
			config := &models.Config{
				PortAPIURL:        portURL,
				ClientID:          clientID,
				ClientSecret:      clientSecret,
				OldInstallationID: oldInstallID,
				NewInstallationID: newInstallID,
			}

			// Create migrator
			mig := migrator.NewMigrator(client, config)

			// Determine if migrating single blueprint or all
			var bp *string
			if blueprint != "all" {
				bp = &blueprint
			}

			// Run migration
			_, err = mig.Migrate(newDatasourceID, bp, dryRun)
			return err
		},
	}

	cmd.Flags().Bool("dry-run", false, "Show what would be migrated without making changes")

	return cmd
}
