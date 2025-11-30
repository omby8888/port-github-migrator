package commands

import (
	"fmt"
	"sort"

	"github.com/spf13/cobra"
	"github.com/omby8888/port-github-migrator/internal/port"
)

func NewGetBlueprintsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "get-blueprints",
		Short:        "Get all blueprints that the old installation ingested entities into",
		Long:         "List all blueprints that the old GitHub App installation ingested entities into.",
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			portURL, _ := cmd.Flags().GetString("port-url")
			clientID, _ := cmd.Flags().GetString("client-id")
			clientSecret, _ := cmd.Flags().GetString("client-secret")
			oldInstallID, _ := cmd.Flags().GetString("old-installation-id")

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
			if len(missing) > 0 {
				return fmt.Errorf("❌ missing required options: %v", missing)
			}

			// Create Port client
			client := port.NewClient(portURL, clientID, clientSecret)

			// Get blueprints
			blueprints, err := client.GetBlueprintsByDataSource(oldInstallID)
			if err != nil {
				return fmt.Errorf("failed to get blueprints: %w", err)
			}

			// Sort and display
			sort.Strings(blueprints)

			fmt.Println("NAME")
			fmt.Println("────────────────────────")
			for _, bp := range blueprints {
				fmt.Println(bp)
			}

			return nil
		},
	}

	return cmd
}
