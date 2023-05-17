import { getCurrentLocaleStore, globalDrupalStateStores } from '../lib/stores';
import { getPreview } from '../lib/getPreview';
import { translatePath } from '@pantheon-systems/drupal-kit';
import { NextSeo } from 'next-seo';
import { IMAGE_URL } from '../lib/constants';

import Link from 'next/link';
import Layout from '../components/layout';
import { ContentWithImage } from '@pantheon-systems/nextjs-kit';
import styles from './catch-all.module.css';

export default function CatchAllRoute({
	pageData,
	hrefLang,
	footerMenu,
	preview,
}) {
	const RenderPage = () => {
		if (pageData?.type === 'node--page') {
			const {
				title,
				body: { processed },
			} = pageData;
			return <>
                <article className={`${styles.container} flex flex-col max-w-screen-md`}>
                    <h1>{title}</h1>
                    <Link passHref href="/pages">
                        Pages &rarr;
                    </Link>
                        <div 
                            className={`${styles.content} text-gray-700 mt-12`}
                            dangerouslySetInnerHTML={{ __html: processed }}
                        />
                </article>
            </>;
		}

		if (pageData?.type === 'node--article') {
			const {
				title,
				body: { processed },
				field_media_image,
				thumbnail,
			} = pageData;
			const imgSrc = field_media_image?.field_media_image?.uri.url;

			return (
				<ContentWithImage
					title={title}
					content={processed}
					imageProps={
						imgSrc
							? {
									src: IMAGE_URL + imgSrc,
									alt: thumbnail?.resourceIdObjMeta?.alt,
								}
							: undefined
					}
				/>
			);
		}

		return (
			<>
				<h2 className="text-xl text-center mt-14">No content found 🏜</h2>
			</>
		);
	};
	return (
		<Layout preview={preview} footerMenu={footerMenu}>
			<NextSeo
				title="Decoupled Next Drupal Demo"
				description="Generated by create pantheon-decoupled-kit."
				languageAlternates={hrefLang}
			/>
			<RenderPage />
		</Layout>
	);
}

export async function getServerSideProps(context) {
	try {
		const {
			locale,
			locales,
			params: { alias },
		} = context;
		const origin = process.env.NEXT_PUBLIC_FRONTEND_URL;
		const hrefLang = locales.map((locale) => {
			return {
				hrefLang: locale,
				href: origin + '/' + locale,
			};
		});
		const lang = context.preview ? context.previewData.previewLang : locale;

		const store = getCurrentLocaleStore(lang, globalDrupalStateStores);

		// get the path from the params
		const path = Array.isArray(alias) ? alias.join('/') : alias;
		// get the uuid and resource name from the resource's path alias
		const {
			entity: { uuid },
			jsonapi: { resourceName },
		} = await translatePath(
			`${store.apiBase}/router/translate-path/`,
			path,
			{},
		);

		// determine params from the resourceName
		const params =
			resourceName === 'node--article'
				? 'include=field_media_image.field_media_image'
				: '';
		const previewParams =
			context.preview && (await getPreview(context, resourceName, params));

		if (previewParams?.error) {
			return {
				redirect: {
					destination: previewParams.redirect,
					permanent: false,
				},
			};
		}

		// fetch page data
		const pageData = await store.getObject({
			objectName: resourceName,
			id: uuid,
			params: context.preview ? previewParams : params,
			refresh: true,
			res: context.res,
			anon: context.preview ? false : true,
		});

		const footerMenu = await store.getObject({
			objectName: 'menu_items--main',
			refresh: true,
			res: context.res,
			anon: true,
		});
		return {
			props: {
				pageData,
				hrefLang,
				footerMenu,
				preview: Boolean(context.preview),
			},
		};
	} catch (error) {
		console.error(`There was an error while fetching data: `, error);
		return {
			notFound: true,
		};
	}
}
