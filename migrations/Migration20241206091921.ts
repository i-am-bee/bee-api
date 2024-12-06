import { Migration } from '@mikro-orm/migrations-mongodb';
import { Ref, ref } from '@mikro-orm/core';

import { User } from '@/users/entities/user.entity';
import { OrganizationUser } from '@/administration/entities/organization-user.entity';
import { Project, ProjectVisiblity } from '@/administration/entities/project.entity';
import { Organization } from '@/administration/entities/organization.entity';
import { UserPrincipal } from '@/administration/entities/principals/user-principal.entity';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';
import { ProjectRole } from '@/administration/entities/constants';

type BaseDocument = { _id: string; createdAt: Date; updatedAt: Date; [key: string]: any };

export class Migration20241206091921 extends Migration {
  async up(): Promise<void> {
    const users = this.getCollection<BaseDocument>(User).find({}, { session: this.ctx });

    const promises = (await users.toArray()).map(async (user) => {
      const organizationUser = await this.getCollection<BaseDocument>(OrganizationUser).findOne(
        {
          user: user._id,
          organization: user.defaultOrganization
        },
        { session: this.ctx }
      );

      if (!organizationUser) {
        // eslint-disable-next-line no-console
        console.log('User not part of Default org.');
        return;
      }

      const project = new Project({
        name: `${user.name}'s project`,
        organization: ref(Organization, user.defaultOrganization),
        createdBy: ref(OrganizationUser, organizationUser._id),
        visibility: ProjectVisiblity.PRIVATE
      });
      await this.getCollection<BaseDocument>(Project).insertOne(
        {
          _id: project.id,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          organization: project.organization.id,
          createdBy: project.createdBy.id,
          name: project.name,
          visibility: project.visibility,
          status: project.status
        },
        { session: this.ctx }
      );

      const userPrincipal = new UserPrincipal({
        user: ref(OrganizationUser, organizationUser._id)
      });
      const projectPrincipal = new ProjectPrincipal({
        project: ref(project),
        createdBy: {
          id: 'placeholder'
        } as unknown as Ref<ProjectPrincipal>,
        principal: userPrincipal,
        role: ProjectRole.ADMIN
      });
      projectPrincipal.createdBy = ref(projectPrincipal);
      await this.getCollection<BaseDocument>(ProjectPrincipal).insertOne(
        {
          _id: projectPrincipal.id,
          createdAt: projectPrincipal.createdAt,
          updatedAt: projectPrincipal.updatedAt,
          project: projectPrincipal.project.id,
          createdBy: projectPrincipal.createdBy.id,
          principal: {
            type: userPrincipal.type,
            user: userPrincipal.user.id
          },
          role: projectPrincipal.role
        },
        { session: this.ctx }
      );

      await this.getCollection<BaseDocument>(User).updateOne(
        {
          _id: user._id
        },
        {
          $set: {
            defaultProject: project.id
          }
        },
        { session: this.ctx }
      );
    });

    await Promise.all(promises);
  }
}
